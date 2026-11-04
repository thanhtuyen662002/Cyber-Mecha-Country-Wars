# Recorded audio (optional)

Put CC0 / public-domain sound files here and list them in `manifest.json`. Without a manifest the
game uses its synthesized sound and music. Record every file's source and license in `CREDITS.md`.

```json
{
  "sfx": {
    "gun":      { "files": ["sfx/rifle1.ogg", "sfx/rifle2.ogg"], "gain": 0.8 },
    "boom":     { "files": ["sfx/explosion1.ogg"] },
    "bigboom":  { "files": ["sfx/huge1.ogg"] }
  },
  "music": { "calm": ["music/calm1.ogg"], "battle": ["music/battle1.ogg"] }
}
```

Sound kinds: gun, flak, sniper, flame, cannon, laser, rocket, boom, bigboom, thunder, alarm, drop,
whistle, ricochet, clang, splash, steam. Several files per kind are picked at random with a small
pitch change, so 2-4 variations each is ideal. Heavy kinds (boom, bigboom, cannon, thunder) keep
the synthesized sub-bass under the recording; the rest play the recording alone. Music: `calm`
plays when the field is quiet, `battle` fades in as the fight grows; each track loops by picking a
new file when it ends. Keep the whole folder under ~30 MB (OGG Vorbis ~128 kbps).
