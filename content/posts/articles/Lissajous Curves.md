---
title: "Lissajous Curves: a simple example of maths that looks good"
description: This post tries to be easily understandable while covering the maths behing the Lissajous curves and exploring its different real world applications.
date: 2026-02-01
slug: lissajous-curves
type: article
tags:
  - interaction
  - mathematics
  - physics
  - engineering
lang: en
toc: auto
---
## The beginning

Like most of the times, it begins with two different scientists. 

The curves we call "Lissajous" actually have an earlier origin. In 1815, American mathematician Nathaniel Bowditch first described these curve patterns while studying pendulum motion.

But it was the French physicist Jules Antoine Lissajous who, in the 1850s, made them visually beautiful. His experiment was simple: mirrors attached to vibrating tuning forks, projecting beams of light onto a screen. Sound, via light, became "visible". The curves took his name and are still pretty useful scientifically to this day.

![Historical image](historical_experiment_photo.webp)
Figure 1. Experiment of Lissajous. The light-figures produced by the compound vibrations of two tuning forks vibrating at different pitches. Source: Privat-Deschanel A. and de Ochoa y Ronna E., Tratado elemental de física, Hachette, Paris (1872), pp. 696–697 [^1]

![Experiment](experiment_diagram.webp)
Figure 2. Modern recreation of Lissajous's experiment. Two tuning forks arranged at 90 degrees, each with a mirror on one tyne. A laser beam reflects off both mirrors in sequence; when the forks are struck, the beam traces a Lissajous pattern on the screen. Source: UC Berkeley Physics Lecture Demonstrations [^2]

---

## The Mathematics

A Lissajous curve appears when two perpendicular oscillations (aka. waves) combine (thus the two tuning forks turned in different directions). Here is the math for those two oscillations:

$$
\begin{cases}
X = A_x \cos(2\pi f_x t + \phi_x) \\
Y = A_y \cos(2\pi f_y t + \phi_y)
\end{cases}
$$

Where:
- $A_x$ and $A_y$ control amplitude (the size in each direction)
- $f_x$ and $f_y$ are the frequencies of oscillation (in Hz)
- $\phi_x$ and $\phi_y$ are the phase offsets
- $t$ is time

### Frequency Ratios and Periodicity

If both frequencies share a greatest common divisor $f_0$, we can write:

$$
\frac{f_x}{f_y} = \frac{n_x f_0}{n_y f_0} = \frac{n_x}{n_y}
$$

where $n_x$ and $n_y$ are coprime integers (bare with me, it does get interesting). This ratio determines everything about the curve's structure (or at least most of it). The value $f_0$ becomes the **frame rate**; the frequency at which the entire pattern repeats. Another way of seeing it: every $1/f_0$ seconds, the trajectory traces exactly the same path.

| Ratio $n_x : n_y$ | Result                                          |
| ----------------- | ----------------------------------------------- |
| $1:1$             | Ellipse (or circle, or line depending on phase) |
| $1:2$             | The shape of the number 8                       |
| $2:3$             | More complex **closed** loop                    |
| $1:\sqrt{2}$      | Never closes: fills the rectangle forever       |

Simple ratios produce closed curves. Irrational ratios create paths that never repeat their complete trajectory. They are deterministic, though: nothing random is happening.

<pl-lissajous-closure class="post-media" caption="One curve closes; the other keeps exploring. Both begin at the same moment. The time-lapse stops after ten seconds; replay to watch it again.">
  <p class="post-component-fallback">A rational frequency ratio closes after one period. An irrational ratio never repeats the complete trajectory.</p>
</pl-lissajous-closure>

### The Phase Parameter $k$

The combined effect of both phase offsets can be combined in a single parameter $k$, defined as:

$$
k = \frac{4}{\pi}(n_x \phi_y - n_y \phi_x)
$$

This parameter has a period of 8, meaning $k$ and $k + 8$ produce identical figures. When $k$ is an integer, *eight distinct basic figures exist for any given frequency ratio*.

Assuming $n_x > n_y$ and setting $\phi_x = 0$, the equations simplify to:

$$
\begin{cases}
X = A_x \cos(2\pi n_x f_0 t) \\
Y = A_y \cos\left(2\pi n_y f_0 t + \dfrac{k\pi}{4n_x}\right)
\end{cases}
$$

The figure below shows how $k$ affects the trajectory for various frequency ratios. Notice that when $k = 2$ or $k = 6$, the figures becomes as symmetrical as possible (about both axes and the origin at the same time).

![Lissajous basic graphs for different frequency ratios](curves_k.webp)
Figure 3. Lissajous basic graphs for frequency ratios $n_x : n_y$ of 1:1, 2:1, 3:1, 3:2, 4:3, 5:3, and 5:4 (rows) with phase parameter $k$ from 0 to 7 (columns). When $k$ is constant, trajectory density increases with frequency. At constant frequency ratio, different $k$ values produce different trajectory densities. Source: Wang et al., Microsystems & Nanoengineering (2020) [^3]

### Symmetry Properties

We can actually predict how symetrical a Lissajous curve will be based on the parity of $n_x$ and $n_y$:

- When $n_x$ is even → symmetric about the $x$-axis
- When $n_y$ is even → symmetric about the $y$-axis
- When both are odd → symmetric about the origin

Two Lissajous patterns with parameters $(n_x, n_y, k)$ and $(n_x', n_y', k')$ are identical if and only if:

$$
n_x' = n_x, \quad n_y' = n_y, \quad k' = k + 8m
$$

where $m$ is any integer.

That's it for the theorical part, let's see how is all of that useful.

### Fill Factor: Measuring Trajectory Density

A critical property for applications is the **fill factor (FF)**. It's a measure of how densely the curve covers its bounding rectangle. Lissajous trajectories are know to be dense at the edges and sparse near the center. Mathematically speaking, the maximum gap appears in an approximate parallelogram containing the origin.

<pl-lissajous-gap class="post-media" caption="The shaded central cell is approximately a parallelogram. The dashed circle measures the empty space inside it. As the curves get denser, that gap shrinks.">
  <p class="post-component-fallback">A small, approximately parallelogram-shaped cell near the centre contains the largest gap between scan lines.</p>
</pl-lissajous-gap>

For scanning applications like LIDAR (e.g. self driving cars), minimizing this gap (or maximizing density) is super important. Research has shown that $k = 2$ produces optimal density for most frequency ratios. I'll develop more on the various applications of the curves [here](##Applications) in that same article.

---

## Seeing Sound: The Music Connection

This is what Lissajous enderstood from the beginning: those frequency ratios *are* musical intervals.

| Ratio | Musical Interval |
|-------|------------------|
| $1:2$ | Octave |
| $2:3$ | Perfect fifth |
| $3:4$ | Perfect fourth |
| $4:5$ | Major third |

Simple frequency ratios often correspond to familiar consonant intervals. But a closed curve alone does not tell you whether a pair of notes sounds pleasant: dissonant intervals can also have rational ratios. And a piano uses equal temperament, which nudges most intervals away from their exact simple ratios.

Pick a note above C, listen to the pair, and watch its curve. This demo uses exact frequency ratios.

<pl-lissajous-intervals class="post-media" caption="C4 stays fixed; press another key to hear both notes and see their curve. Exact frequency ratios make the figures close. Sound is synthesized in your browser.">
  <p class="post-component-fallback">Compare piano notes and their curves with JavaScript enabled. Audio starts only when you press a key.</p>
</pl-lissajous-intervals>

<figure class="post-media">
  <pl-audio-player label="C and G · a perfect fifth">
    <audio src="/posts/components/media/perfect-fifth.mp3" preload="metadata" controls></audio>
  </pl-audio-player>
  <figcaption class="post-caption"><span>C4, then G4, then both, in piano tuning. Piano-like tones synthesized for this page.</span><span class="post-caption__index">Audio / 01</span></figcaption>
</figure>

---

## Making Your Own

### The Victorian Way: Harmonographs

Before computers, there were harmonographs: pendulum-based drawing machines popular in the 1800s. Two or more pendulums swing in perpendicular directions, and a pen traces their combined motion onto paper.

### Simpler Experiments

- **Sand pendulums**: A funnel of sand swinging over paper
- **Laser on speakers**: Mount a mirror on one speaker cone, bounce a laser off it onto a wall, play two frequencies through stereo speakers (similar to how Lissajous did it)
- **Oscilloscope**: Feed two audio signals into $X$ and $Y$ inputs (easy to do and actually useful)

<figure class="post-media">
  <pl-video-player label="A sand pendulum records its oscillation" ratio="16 / 9">
    <video src="/posts/components/media/sand-pendulum.mp4" poster="/posts/components/media/sand-pendulum.jpg" preload="metadata" playsinline controls>
      <a href="/posts/components/media/sand-pendulum.mp4">Download the sand-pendulum video</a>
    </video>
  </pl-video-player>
  <figcaption class="post-caption"><span>A sand pendulum draws a wave on a moving belt: one oscillation made visible. Video: <a href="https://hubbs.schule/mediathek/pendel-mit-sandspur" target="_blank" rel="noopener noreferrer">Ecole Science, via HubbS</a>, <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">CC0</a>.</span><span class="post-caption__index">Video / 01</span></figcaption>
</figure>

### The Modern Way: Code (of course I was going to talk about code)

A few lines in Python will generate infinite variations:

```python copy
import numpy as np
import matplotlib.pyplot as plt

t = np.linspace(0, 1, 10000)
nx, ny = 5, 4
k = 2
f0 = 1

x = np.cos(2 * np.pi * nx * f0 * t)
y = np.cos(2 * np.pi * ny * f0 * t + k * np.pi / (4 * nx))

plt.plot(x, y)
plt.axis('equal')
plt.show()
```

Play with `nx`, `ny`, and `k`. Watch the curves change.

---

## Applications

### Science and Engineering

**Oscilloscopes** have used Lissajous figures since the early 20th century to compare signal frequencies. An unknown frequency into one axis, a known reference into the other. The resulting shape instantly reveals their ratio and thus the frequency you're looking for.

### MEMS LIDAR and Laser Scanning

Modern microelectromechanical systems (MEMS) scanning mirrors exploit Lissajous trajectories for solid-state LIDAR systems. By driving a two-axis mirror with sinusoidal waveforms at carefully chosen frequencies, engineers create scanning patterns that cover a field of view with predictable density and timing.

It extremely useful, espcially for autonomous vehicle sensing or 3D imaging microscopy for example.

### Art and Design

Perhaps the most famous domain where Lissajous figure hide in plain sight: design. On of the most well know appearance of a Lissajous curve is the **ABC television logo**, a stylized $1:3$ ratio curve that has represented the network since 1965.

More recently, Meta's 2021 rebrand introduced a logo that is essentially an infinite loop: a Lissajous-like figure rotated 90° (close to a $2:1$ ratio curve).

![Meta Logo](meta-logo.svg)
Figure 4. Current Meta Logo [^4]

---

## Beyond Two Dimensions

### Lissajous Knots

Add a third oscillation:

$$
Z = A_z \cos(2\pi f_z t + \phi_z)
$$

Now the curve is in 3D space. That was easy. Depending on the frequency ratios, it can form true mathematical knots: curves that loop through themselves in ways that cannot be untangled without cutting. Similar mathematically to the 2D closed curve patterns.

These *Lissajous knots* have become a subject of topological study.

---

## The fun

It's so fun to play with the parameters, I had to make a simulator

<pl-lissajous-lab class="post-media">
  <p class="post-component-fallback">The interactive Lissajous curve generator requires JavaScript.</p>
</pl-lissajous-lab>

[Open the Lissajous generator](/posts/components/apps/lissajous.html).

[^1]: Privat-Deschanel, A. & de Ochoa y Ronna, E. *Tratado elemental de física*, Hachette, Paris (1872), pp. 696–697. Via ResearchGate. https://www.researchgate.net/figure/Experiment-of-Lissajous-The-light-figures-produced-by-the-compound-vibrations-of-two_fig8_369266058

[^2]: UC Berkeley Physics Lecture Demonstrations. Lissajous Figures created with two tuning forks with mirrors. https://berkeleyphysicsdemos.net/node/7751

[^3]: Wang, J., Zhang, G. & You, Z. Design rules for dense and rapid Lissajous scanning. *Microsystems & Nanoengineering* **6**, 101 (2020). https://doi.org/10.1038/s41378-020-00211-4

[^4]: Meta Platforms, Public domain, via Wikimedia Commons. https://fr.wikipedia.org/wiki/Fichier:Meta_Platforms_Inc._logo.svg
