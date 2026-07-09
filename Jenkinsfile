pipeline {
  agent any

  environment {
    REPO_DIR = 'repo'
    COMPOSE_FILE = 'docker-compose.yml'
    COMPOSE_PROJECT_NAME = 'video-editor'
    VIDEO_EDITOR_DATA_ROOT = '/var/lib/jenkins/video-editor-data'
  }

  options {
    timestamps()
    skipDefaultCheckout(true)
  }

  stages {
    stage('Prepare Runtime Dirs') {
      steps {
        sh '''
          mkdir -p "$VIDEO_EDITOR_DATA_ROOT/uploads" \
                   "$VIDEO_EDITOR_DATA_ROOT/outputs" \
                   "$VIDEO_EDITOR_DATA_ROOT/final-outputs" \
                   "$VIDEO_EDITOR_DATA_ROOT/temp" \
                   "$VIDEO_EDITOR_DATA_ROOT/cookies"
          # Ensure jenkins owns the dirs (fixes read-only mount errors from Docker)
          chown -R jenkins:jenkins "$VIDEO_EDITOR_DATA_ROOT" || true
        '''
      }
    }

    stage('Checkout') {
      steps {
        dir(env.REPO_DIR) {
          checkout scm
        }
      }
    }

    stage('Install Cookies File') {
      steps {
        dir(env.REPO_DIR) {
          sh '''
            test -f cookies/ytdlp_cookies.txt || (echo "MISSING in repo: cookies/ytdlp_cookies.txt" && exit 1)
            cp cookies/ytdlp_cookies.txt "$VIDEO_EDITOR_DATA_ROOT/cookies/ytdlp_cookies.txt"
            chmod 600 "$VIDEO_EDITOR_DATA_ROOT/cookies/ytdlp_cookies.txt"
          '''
        }
      }
    }

    stage('Verify Cookies File') {
      steps {
        sh 'ls -la "$VIDEO_EDITOR_DATA_ROOT/cookies" || true'
        sh 'test -f "$VIDEO_EDITOR_DATA_ROOT/cookies/ytdlp_cookies.txt" && echo "OK: runtime cookies file exists" || (echo "MISSING: $VIDEO_EDITOR_DATA_ROOT/cookies/ytdlp_cookies.txt" && exit 1)'
      }
    }

    stage('Build Images') {
      steps {
        dir(env.REPO_DIR) {
          sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE build --no-cache --pull'
        }
      }
    }

    stage('Deploy') {
      steps {
        dir(env.REPO_DIR) {
          sh '''
            echo "=== [1/4] Graceful down ==="
            docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE down || true

            echo "=== [2/4] Kill tout conteneur du projet bloqué (permission denied fallback) ==="
            for cid in $(docker ps -aq --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME"); do
              # Tenter suppression normale
              docker rm -f "$cid" 2>/dev/null && continue || true

              # Fallback : tuer le processus Linux directement
              pid=$(docker inspect --format="{{.State.Pid}}" "$cid" 2>/dev/null || echo "")
              if [ -n "$pid" ] && [ "$pid" != "0" ]; then
                echo "Force-killing PID $pid for container $cid"
                sudo kill -9 "$pid" 2>/dev/null || true
                sleep 1
              fi
              sudo docker rm -f "$cid" 2>/dev/null || true
            done

            echo "=== [3/4] Supprimer les conteneurs zombies Created du projet ==="
            for cid in $(docker ps -aq --filter "status=created" --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME"); do
              docker rm -f "$cid" 2>/dev/null || sudo docker rm -f "$cid" 2>/dev/null || true
            done

            echo "=== [4/4] Démarrage ==="
            docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE up -d --force-recreate --remove-orphans
          '''
        }
      }
    }

    stage('Verify Cookies In Container') {
      steps {
        dir(env.REPO_DIR) {
          sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE exec -T backend ls -la /app/cookies'
          sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE exec -T backend head -n 1 /app/cookies/ytdlp_cookies.txt'
          sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE exec -T backend sh -lc "head -n 5 /app/cookies/ytdlp_cookies.txt"'
          sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE exec -T backend sh -lc "stat -c \'mtime=%y size=%s bytes\' /app/cookies/ytdlp_cookies.txt"'
          sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE exec -T backend sh -lc "node /app/scripts/validate_cookies.js /app/cookies/ytdlp_cookies.txt || true"'
        }
      }
    }

    stage('Test yt-dlp in Container') {
      steps {
        dir(env.REPO_DIR) {
          sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE exec -T backend sh -lc "which node || true"'
          sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE exec -T backend sh -lc "node -v || true"'
          sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE exec -T backend yt-dlp --js-runtimes node --cookies /app/cookies/ytdlp_cookies.txt -v "https://www.youtube.com/watch?v=gR4KxDPcFMI" || true'
        }
      }
    }
  }

  post {
    always {
      script {
        if (fileExists("${env.REPO_DIR}/${env.COMPOSE_FILE}")) {
          dir(env.REPO_DIR) {
            sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE ps || true'
          }
        } else {
          echo 'Skipping docker compose ps: repository checkout did not complete.'
        }
      }
    }
  }
}
