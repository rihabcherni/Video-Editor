#!/usr/bin/env python3
import sys
import os
import argparse
from faster_whisper import WhisperModel


def format_time(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int((t - int(t)) * 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="Input audio file")
    parser.add_argument("output", help="Output .srt file")
    parser.add_argument("model", nargs="?", default="small", help="Whisper model name")
    parser.add_argument("language", nargs="?", default="auto", help="Language code or 'auto'")
    parser.add_argument("--language", dest="language_flag", help="Language code override")
    parser.add_argument("--fast", action="store_true", help="Faster but less accurate settings")
    parser.add_argument("--beam-size", type=int, default=None, help="Beam size")
    parser.add_argument("--best-of", type=int, default=None, help="Best-of")
    parser.add_argument("--vad", action="store_true", help="Enable VAD filtering")
    args = parser.parse_args()

    audio_file = args.input
    srt_file = args.output
    model_name = args.model
    language = args.language_flag or args.language

    device = os.environ.get("WHISPER_FASTER_DEVICE", "cpu")
    compute_type = os.environ.get("WHISPER_FASTER_COMPUTE_TYPE", "int8")

    if not os.path.exists(audio_file):
        print(f"Error: input file '{audio_file}' not found.")
        sys.exit(1)

    model = WhisperModel(model_name, device=device, compute_type=compute_type)

    if args.fast:
        beam_size = 1
        best_of = 1
        vad_filter = True
    else:
        beam_size = args.beam_size if args.beam_size is not None else 5
        best_of = args.best_of if args.best_of is not None else 5
        vad_filter = args.vad

    if language and language != "auto":
        segments, _info = model.transcribe(
            audio_file,
            language=language,
            beam_size=beam_size,
            best_of=best_of,
            vad_filter=vad_filter,
        )
    else:
        segments, _info = model.transcribe(
            audio_file,
            beam_size=beam_size,
            best_of=best_of,
            vad_filter=vad_filter,
        )

    with open(srt_file, "w", encoding="utf-8") as f:
        for i, segment in enumerate(segments, start=1):
            start = format_time(segment.start)
            end = format_time(segment.end)
            text = segment.text.strip()
            f.write(f"{i}\n{start} --> {end}\n{text}\n\n")


if __name__ == "__main__":
    main()
