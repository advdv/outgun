---
title: Cupboard sensor
layout: cupboard-sensor
---

Click **Start camera** and allow camera access, then click **Enable music**.
Wait for the music status to say **Ready** or **Playing**. Open and close the
cupboard: each opening plays the supplied track from **0:06**, looping back to
**0:06** if the door stays open. Each closing stops it. Reloading requires
enabling the camera and music again.

The flag should read
**Music: START** when open and **Music: STOP** when closed. The defaults assume
that brighter means open: the calibration graph settled near 49–50% closed
and 56–58% open. Brief extremes of 39.9% and 61.0% are not the settled levels.

Adjust the two thresholds and click **Apply thresholds** if needed. Check a few
open/close cycles with the laptop, screen brightness, and room lighting fixed.
These are image measurements, not lux; automatic exposure or changing lighting
can shift them. **Disable music** silences playback without stopping calibration.
