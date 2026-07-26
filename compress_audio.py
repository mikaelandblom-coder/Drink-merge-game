"""Re-encode the BGM tracks down to a sane streaming bitrate.

WHY: assets/audio/ holds ~41 MB of music. Since index.html switched the <audio>
element to preload="none", only the ONE track a player actually hears is ever
fetched -- but that track is still 4-10 MB, which is the largest single item in a
play session. These are looping backing tracks sitting under synth SFX, not
listening material, so 320 kbps buys nothing a player can hear.

See CLAUDE.md "Bandwidth" for the full per-visit budget.

REQUIRES ffmpeg on PATH. It is not installed by default on this machine:
    winget install --id Gyan.FFmpeg -e
`--check` works WITHOUT ffmpeg -- it parses MP3 frame headers directly, so you
can always see what the current bitrates are.

Re-encoding is IN PLACE. The originals are recoverable from git history
(`git show <rev>:assets/audio/<name>.mp3 > restored.mp3`), and keeping the paths
stable means config/maps.js needs no edit. Re-running is safe: a file already at
or below the target bitrate is skipped, so repeated runs never stack generation
loss.

Usage:
    python compress_audio.py --check          # report bitrates, write nothing
    python compress_audio.py                  # re-encode above-target files
    python compress_audio.py --bitrate 96     # pick a different target
"""
import argparse
import os
import shutil
import stat
import struct
import subprocess
import sys
import time
from pathlib import Path

AUDIO_DIR = Path('assets/audio')
# 112 kbps joint stereo is the default: transparent enough for a looping music
# bed mixed under the synth SFX, and ~1/3 of a 320 kbps file. Drop to 96 if a
# specific track is still the heaviest thing in a session.
DEFAULT_BITRATE = 112

_V1L3_BITRATES = {1: 32, 2: 40, 3: 48, 4: 56, 5: 64, 6: 80, 7: 96, 8: 112,
                  9: 128, 10: 160, 11: 192, 12: 224, 13: 256, 14: 320}
_SAMPLE_RATES = {0: 44100, 1: 48000, 2: 32000}
_CHANNELS = {0: 'stereo', 1: 'joint', 2: 'dual', 3: 'mono'}


def probe(path: Path):
    """Measure a track without ffmpeg. Returns (kbps, sample_rate, chan, seconds).

    The reported kbps is the AVERAGE over the file, which is the only number that
    matters for bandwidth. Getting it right requires care: these tracks are VBR,
    and a VBR file's first frame header advertises whatever bitrate that one frame
    happened to use (64 for every track here) -- reading that as "the bitrate"
    made an earlier version of this script conclude the files were already tiny
    and skip all of them, when they actually average ~190 kbps.

    So: prefer the Xing/Info VBR tag, which carries the total FRAME COUNT ->
    exact duration -> true average bitrate. Fall back to the frame header only
    when there is no such tag (a genuine CBR file), where the two agree anyway.
    Validated against the browser's own HTMLAudioElement.duration for all eight
    shipped tracks.
    """
    data = path.read_bytes()
    i = 0
    if data[:3] == b'ID3':                      # skip an ID3v2 tag if present
        size = ((data[6] & 0x7f) << 21) | ((data[7] & 0x7f) << 14) \
             | ((data[8] & 0x7f) << 7) | (data[9] & 0x7f)
        i = 10 + size
    while i < len(data) - 4:
        if data[i] == 0xFF and (data[i + 1] & 0xE0) == 0xE0:
            h = struct.unpack('>I', data[i:i + 4])[0]
            version = (h >> 19) & 3             # 3 = MPEG-1
            layer = (h >> 17) & 3               # 1 = Layer III
            b_idx = (h >> 12) & 0xF
            s_idx = (h >> 10) & 3
            mode = (h >> 6) & 3
            if version == 3 and layer == 1 and b_idx in _V1L3_BITRATES and s_idx in _SAMPLE_RATES:
                sample_rate = _SAMPLE_RATES[s_idx]
                chan = _CHANNELS[mode]
                # Xing/Info sits inside this first frame, right after the side
                # info block: 17 bytes for mono, 32 for any stereo mode.
                side = 17 if mode == 3 else 32
                tag = data[i + 4 + side:i + 4 + side + 4]
                frames = None
                if tag in (b'Xing', b'Info'):
                    flags = struct.unpack('>I', data[i + 8 + side:i + 12 + side])[0]
                    if flags & 1:               # frame count present
                        frames = struct.unpack('>I', data[i + 12 + side:i + 16 + side])[0]
                if frames:
                    # MPEG-1 Layer III is a fixed 1152 samples per frame.
                    seconds = frames * 1152 / sample_rate
                    kbps = round(len(data) * 8 / seconds / 1000)
                else:
                    kbps = _V1L3_BITRATES[b_idx]
                    seconds = len(data) * 8 / (kbps * 1000)
                return kbps, sample_rate, chan, seconds
        i += 1
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='report only, write nothing')
    ap.add_argument('--bitrate', type=int, default=DEFAULT_BITRATE, help='target kbps')
    args = ap.parse_args()

    # Drop any .tmp.mp3 left behind by a previous run that hit a file lock, so
    # they are never mistaken for real tracks (the glob below would list them).
    for stale in AUDIO_DIR.glob('*.tmp.mp3'):
        stale.unlink()
        print('cleaned up stale %s' % stale.name)

    files = sorted(p for p in AUDIO_DIR.glob('*.mp3') if not p.name.endswith('.tmp.mp3'))
    if not files:
        print('No mp3 files under %s' % AUDIO_DIR)
        return

    print('%-28s %6s %7s %-7s %6s %9s' % ('file', 'kbps', 'Hz', 'chan', 'sec', 'MB'))
    print('-' * 68)
    todo, total_mb = [], 0.0
    for p in files:
        mb = p.stat().st_size / 1024 / 1024
        total_mb += mb
        info = probe(p)
        if not info:
            print('%-28s %s %9.1f' % (p.name[:28], '   (header unparsed)'.ljust(29), mb))
            continue
        kbps, sr, chan, secs = info
        flag = '' if kbps <= args.bitrate else '  <- over target'
        print('%-28s %6d %7d %-7s %6.0f %9.1f%s' % (p.name[:28], kbps, sr, chan, secs, mb, flag))
        if kbps > args.bitrate:
            todo.append((p, kbps, mb))
    print('-' * 68)
    print('%-28s %38.1f' % ('TOTAL', total_mb))
    print('')

    if not todo:
        print('Nothing above %d kbps -- all tracks already at or below target.' % args.bitrate)
        return

    est = sum(mb * args.bitrate / kbps for _, kbps, mb in todo)
    cur = sum(mb for _, _, mb in todo)
    print('%d file(s) above %d kbps: %.1f MB -> ~%.1f MB estimated (-%.0f%%)'
          % (len(todo), args.bitrate, cur, est, 100 * (1 - est / cur)))

    if args.check:
        print('(--check: nothing written)')
        return

    if not shutil.which('ffmpeg'):
        print('')
        print('ERROR: ffmpeg is not on PATH, so nothing was re-encoded.')
        print('Install it with:  winget install --id Gyan.FFmpeg -e')
        print('then re-run:      python compress_audio.py')
        sys.exit(1)

    print('')
    for p, kbps, mb in todo:
        tmp = p.with_suffix('.tmp.mp3')
        # -map 0:a drops any cover art (a few hundred KB on some Suno exports)
        # and -map_metadata -1 strips tags; neither is used by the game.
        cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', str(p),
               '-map', '0:a', '-map_metadata', '-1',
               '-c:a', 'libmp3lame', '-b:a', '%dk' % args.bitrate,
               '-joint_stereo', '1', str(tmp)]
        r = subprocess.run(cmd)
        if r.returncode != 0 or not tmp.exists():
            print('  FAILED (kept original): %s' % p.name)
            tmp.unlink(missing_ok=True)
            continue
        new_mb = tmp.stat().st_size / 1024 / 1024
        if new_mb >= mb:
            print('  SKIP (no gain, kept original): %s' % p.name)
            tmp.unlink()
            continue
        # Two DIFFERENT Windows conditions both surface as PermissionError
        # (WinError 5) here, and they need different handling:
        #
        # 1. The READ-ONLY attribute on the target. os.replace refuses to
        #    overwrite it no matter how long you wait. Melody Lane.mp3 shipped
        #    with this flag set (the other seven tracks did not), which is what
        #    made it look like a stubborn lock. Clear it and retry -- git does
        #    not track the attribute, so this has no repo effect.
        # 2. A real open handle from another process (a browser tab that played
        #    the track keeps one until its <audio> src is cleared). That one does
        #    clear on its own, so a short retry is the right response.
        #
        # Tell them apart before retrying: os.access(W_OK) is False only for (1).
        if not os.access(p, os.W_OK):
            p.chmod(stat.S_IWRITE | stat.S_IREAD)
            print('        (cleared read-only attribute on %s)' % p.name)
        for attempt in range(6):
            try:
                tmp.replace(p)
                break
            except PermissionError:
                if attempt == 5:
                    print('  LOCKED by another process (kept original, .tmp.mp3 left'
                          ' in place): %s' % p.name)
                    print('        close anything playing it, then re-run.')
                    break
                time.sleep(0.5)
        if not tmp.exists():
            print('  %6.1f MB -> %5.1f MB  (-%2.0f%%, %d kbps)  %s'
                  % (mb, new_mb, 100 * (1 - new_mb / mb), args.bitrate, p.name))

    # Exclude any .tmp.mp3 a lock left behind, or it inflates the "after" total
    # by a whole duplicate track and hides the saving.
    after = sum(p.stat().st_size for p in AUDIO_DIR.glob('*.mp3')
                if not p.name.endswith('.tmp.mp3')) / 1024 / 1024
    print('')
    print('assets/audio total: %.1f MB -> %.1f MB' % (total_mb, after))
    print('Remember the deploy checklist: bump GAME_VERSION + the ?v= busters.')


if __name__ == '__main__':
    main()
