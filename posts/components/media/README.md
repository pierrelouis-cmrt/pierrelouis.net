# Component media

Local media for `<pl-video-player>` and `<pl-audio-player>`. Article markup
references these files by absolute public path, for example
`/posts/components/media/perfect-fifth.mp3`.

## perfect-fifth.mp3

- **What:** a piano-like perfect fifth: C4 (261.63 Hz), then G4 (392.00 Hz),
  then both together. 4.6 s, mono, 128 kb/s MP3, about 75 KB.
- **Origin:** synthesized for this site on 2026-11-17. It is not a recording of
  a real piano. Additive synthesis of ten stiff-string partials (inharmonicity
  B = 0.0004), a 12 ms hammer-noise transient, and a two-stage exponential
  decay, rendered to WAV with the Python standard library and encoded with
  ffmpeg/libmp3lame.
- **Credit:** none is owed to a third party. Suggested caption wording:
  "Synthesized for this page."

## sand-pendulum.mp4 and sand-pendulum.jpg

- **Title:** Pendel mit Sandspur (Pendulum with a sand trail).
- **Provider:** Ecole Science, Internationales Gymnasium Pierre Trudeau.
- **Source and licence evidence:** https://hubbs.schule/mediathek/pendel-mit-sandspur
- **Original download:** https://download.sodix.de/api/content/data/SODIX-0001151331.mp4
- **Licence:** CC0, as explicitly listed by HubbS; https://creativecommons.org/publicdomain/zero/1.0/
- **Retrieved:** 2026-11-17. Original 1920 × 1080 MP4, 8.01 seconds, 2,763,480 bytes.
- **Content:** a sand pendulum records a sinusoidal wave on a moving belt. This is a one-dimensional oscillation demonstration, not a two-axis Lissajous experiment.
- **Changes:** video unchanged. Poster is a resized frame at 3 seconds, extracted with ffmpeg.
- **Caption:** “A sand pendulum draws a wave on a moving belt: one oscillation made visible. Video: Ecole Science, via HubbS, CC0.”

## harmonograph.webm, harmonograph.mp4 and harmonograph.jpg

- **Title / creator:** The Harmonograph — The Cardboard Channel.
- **Original:** https://www.youtube.com/watch?v=S92mZcNIS8w
- **Published:** May 1, 2020 (credit supplied in the user's YouTube screenshot).
- **Source:** user-supplied `The Harmonograph [S92mZcNIS8w].mkv`, 29,213,002 bytes; 65.021 seconds, 1920 × 1080 at 50 fps, H.264 video and stereo Opus audio.
- **Rights:** credited to The Cardboard Channel. No Creative Commons or public-domain licence was supplied or verified; the old sand-pendulum clip's CC0 licence does not apply to this video.
- **Changes:** full clip retained, including audio; no cropping, trimming, resolution or frame-rate reduction. Poster extracted at 40 seconds, resized to 1280 × 720 (JPEG quality 3). Metadata removed from encodes.
- **WebM:** VP9 / Opus; ffmpeg `-c:v libvpx-vp9 -crf 31 -b:v 0 -deadline good -cpu-used 2 -row-mt 1 -threads 6 -pix_fmt yuv420p -c:a libopus -b:a 80k`.
- **MP4:** H.264 High, level 4.2 / AAC; ffmpeg `-c:v libx264 -preset slow -crf 26 -level:v 4.2 -maxrate 8M -bufsize 16M -threads 6 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart`.
- **Delivery:** WebM first, MP4 fallback with explicit codec types and a download link. `preload="none"` avoids downloading the clip before interaction; the poster provides an immediate preview.
- **Encoded sizes:** WebM 17,169,128 bytes (41.2% smaller than supplied source); MP4 18,538,228 bytes (36.5% smaller). Poster 57,338 bytes.
- **Quality check:** source comparison over seconds 35–38 using ffmpeg SSIM: WebM 0.990894, MP4 0.990796 (sample measurement, not a whole-clip score).
