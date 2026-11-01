# Rescue the Band 🎤

A pixel-art 2D platformer you play with **your hands in front of a webcam** (or the keyboard).

Monsters crashed the show and kidnapped the band. You are **Nova**, the lead singer, armed with a microphone stand. Defeat the monsters that carry the cage keys, free your five bandmates across three stages, and reunite everyone for the final concert.

## Play

- **Online:** enable GitHub Pages for this repository (see below) and open the link in Chrome or Edge.
- **Locally:** download `index.html` and open it in Chrome or Edge.

The game is one self-contained file. The music is embedded. The hand-tracking library ([MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)) loads from a CDN the first time you enable the camera, so the camera needs an internet connection. Video is processed only in your browser and is never uploaded.

## Controls

| Hand | Open palm | Closed fist | Fist + index finger |
|---|---|---|---|
| **Right** (movement) | Stop | Walk right | Walk left |
| **Left** (actions) | No action | Swing the mic stand | Jump |

Each left-hand action fires once. Change gesture (for example, open your palm) to do it again. Both hands work at the same time.

**Keyboard:** `A`/`D` or arrows to move, `Space`/`W` to jump, `J` to attack, `E` to unlock, `Esc` to pause, `C` to show or hide the camera preview.

Land on a monster's head to stomp it. The prologue tutorial teaches every move. Run **Calibration** from the menu once for the best gesture recognition. If your hands are detected the wrong way round, use **Swap handedness** in Gesture Settings.

## Story

| Stage | Location | Key carrier | Rescued |
|---|---|---|---|
| Prologue | Backstage | — | Tutorial with Sam the stagehand |
| 1 | Ivory Halls | Off-Key Ogre | Mina (keys) & Volt (electronics) |
| 2 | Low-End Caverns | Feedback Golem | Dex (bass) & Riff (guitar) |
| 3 | Thunder Citadel | The Silencer (boss) | Bo (drums) |
| Finale | The big stage | — | The whole band plays "Back On Stage" |

## Repository layout

```
index.html            the built game (open this / serve with GitHub Pages)
src/template.html     page layout, styles, menus
src/js/*.js           game code (engine, gestures, audio, levels, prologue, concert, UI)
audio/*.mp3           the song and the three 8-second rescue clips
music/compose.py      generates the original song "Back On Stage" (six stems + mix)
tools/build.py        bundles src/ + audio/ into index.html
```

After changing anything in `src/` or `audio/`, rebuild with:

```
python tools/build.py
```

To regenerate the song stems (needs Python with `numpy` and `scipy`; writes WAV files):

```
python music/compose.py music/stems
```

## Publish with GitHub Pages

1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. After a minute, the game is live at `https://<your-username>.github.io/<repository-name>/`.

GitHub Pages serves over HTTPS, which browsers require for camera access.

## Credits

Game, pixel art, sound effects and the song "Back On Stage" were created for this project. The song and sound effects are synthesized in code.

---

## בעברית

משחק פלטפורמה בסגנון פיקסלים שמשחקים בתנועות ידיים מול מצלמת הרשת, או במקלדת. יד ימין מזיזה את הדמות ויד שמאל קופצת ותוקפת. כדי לשחק אונליין, הפעילו את GitHub Pages לפי השלבים למעלה ופתחו את הקישור ב-Chrome או ב-Edge.
