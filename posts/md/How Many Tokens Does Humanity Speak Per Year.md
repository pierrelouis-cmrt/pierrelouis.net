---
title: How Many Tokens Does Humanity Speak Per Year?
description: How many tokens do the biggest AI labs process every year? How does that compare to humanity's spoken words?
tags:
  - note
date: 2026-01-10
---
The goal here is only to get an order of magnitude, nothing precise, just coherent enough to get a rough idea of what we're dealing with.

We’ll estimate in 3 steps:

### 1) Words per person per day

A decent global-average is **$\sim 15000$ words/day/person**.

### 2) People

The world population is **$\sim 8\times 10^9$**.

### 3) Total words per year
$$
W_{\text{yr}} \approx (8 \times 10^9) \times (1.5 \times 10^4) \times 365
$$
$$
W_{\text{yr}} \approx 4.38 \times 10^{16} \text{ words/year}
$$
#### 4) Converting Words $\to$ Tokens
In the LLM world, the standard rule of thumb is that **$1000$ tokens $\approx 750$ words**.
Therefore, to get tokens from words, we divide by $0.75$.
$$
T_{\text{yr}} \approx \frac{W_{\text{yr}}}{0.75} \approx 5.86 \times 10^{16} \text{ tokens/year)}
$$
### Final estimate
$$
T_{\text{yr}} \approx 6\times 10^{16}\ \text{tokens/year}
$$
That’s **$\sim 60$ quadrillion tokens/year**.

### How does this compare to AI?

Let's look at the numbers from the biggest AI labs as of late 2025.

Let's start with OpenAI. At Dev Day in October 2025, they said they were processing more than 6B tokens/min. That's 3.1 quadrillion tokens per year. 5% of human speech.

Google indicated they were above 1.3 quadrillion tokens/month in the Google CEO earnings remarks from October 2025. That's 15.6 quadrillion tokens per year, or in other words 26% of the total human speech.

![Tokens Processed/Spoken per Year](assets/chart_tokens.webp)


---

Just two companies alone are now processing a volume of information equivalent to **one-third of all words spoken by all of humanity**.

AI is getting real close to speaking more than us, that's pretty impressive already. And numbers as big as the ones here are already super hard to visualise and comprehend. We often think of "human scale" as an unreachable ceiling, let's see how that changes in the following years!