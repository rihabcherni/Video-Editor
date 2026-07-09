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
          sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE down || true'
          sh 'docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE up -d --force-recreate --remove-orphans'
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
