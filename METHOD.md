# How polarize-ui visualizes scientific data

The components implement this method. Use it to choose a view for a new kind of data, and
to judge whether a view is finished. It is general and uses only established practice.

## 1. Start from the question, not the chart

Before choosing a component, write down in one sentence **what a reader should be able to
decide** from the view: *"is there a 10 Hz peak above the 1/f background?"*, *"does the
observed statistic beat its null?"*, *"do the cells near A lock to A?"*. The question picks
the form:

| the reader needs to judge… | form | component |
|---|---|---|
| a value over time | line, with the threshold it is judged against on the same axes | `LineChart` |
| how power is spread over frequency | spectrum on a log power axis | `LineChart` (`y.type: "log"`) |
| how power moves over time and frequency | time–frequency map with a colour bar | `Heatmap` |
| whether one rhythm's phase organises another's amplitude | comodulogram | `Comodulogram` |
| whether two quantities go together, and how strongly | scatter with a fit and its band | `ScatterPlot` |
| whether a result could be chance | observed value on its null distribution | `NullDistribution` |
| how a few categories compare | bars on a zero baseline | `BarChart` |
| the raw trace behind a summary | waveform, with marked regions | `Waveform` |
| how sure a number is | tier badge beside the number | `Tier`, `Value`, `Readout` |
| how a mechanism behaves | an interactive simulation (section 5) | a model view |

If the sentence cannot be written, the view is not ready to build.

## 2. Five things every science view states rather than implies

1. **The comparison.** A threshold, null or baseline is drawn on the axes of the thing it
   judges, never quoted in prose beside an autoscaled chart.
2. **The scale.** Log axes say so in their label. Colour ranges are on a colour bar. Panels
   meant to be compared share a scale and say so; panels that autoscale separately say
   *that*, because they can't be compared.
3. **What was changed for display.** Thinning, clipping, trimming, resampling and missing
   values are counted and printed on the panel.
4. **The uncertainty.** An estimate carries its interval. A p-value carries its n, its test
   and an effect size, because a small p is not a large effect. When a result is at the
   resolution of the method (for example p at its floor of 1/(n+1)), the view says so.
5. **What it cannot show.** Every method has a blind spot, such as the resolution of a
   filter, the assumption of a surrogate or a confound the method cannot rule out. The view
   prints it: a caveat that lives only in a paper is not read.

## 3. Evidence has a kind, and the kind is always visible

A number on screen is one of: **measured** (read from an instrument or a real recording),
**predicted / modelled** (output of a model), **exploratory**, **speculative**, or
**refuted**. These never share styling, each is shown with a word and a glyph as well as a
colour, and the explanation of a label goes in the documentation drawer, never in place of
the label. A simulation's output is **modelled**, however realistic it looks.

## 4. Choosing the form for common data

| data | primary view | also show | the usual trap |
|---|---|---|---|
| continuous time series (EEG, ECG, magnetometer) | `Waveform` / `LineChart` | the sampling rate and any filter | a filtered trace shown as if raw |
| power spectrum | `LineChart`, log power axis | the aperiodic (1/f) background the peak must clear | a peak on a linear axis that is only 1/f |
| time–frequency | `Heatmap` | the window length (it sets both resolutions) | autoscaled panels compared with each other |
| coupling between bands | `Comodulogram` | resolvable cells, family-wise threshold | coupling produced by sharp or non-sinusoidal waveforms |
| two continuous measures | `ScatterPlot` | which band (confidence or prediction) | reading a confidence band as where new points fall |
| a test against chance | `NullDistribution` | how the null was built and its size | a p-value without its count or effect size |
| repeated responses (trials, beats) | a stack aligned to the event, plus the average with its interval | how many repeats, and how many were rejected | an average that hides that most trials did not respond |
| vector data (3-axis fields) | a hodogram of the band-limited vector | the reference direction (for example the background field) | handedness reported without a reference direction |
| categories | `BarChart` on a zero baseline | n per bar | bars that start above zero |

## 5. Mechanism and simulation views

Some ideas are best understood by watching them happen: a population of neurons competing
over two stimuli, a filter bank responding to a sound, a network settling. These views are
worth building, and they follow the same rules with three additions:

1. **The model is labelled as a model.** Every output is *modelled*, and the model's source
   (the equations, the published model it ports, the parameters) is one click away.
2. **The controls are the model's real parameters**, in their real units, with their
   published ranges. A slider whose values are chosen to look good wears a *taste* label.
3. **A readout ties the picture to a number.** An animation convinces the eye; a measured
   quantity from the simulation (a rate, a locking strength, a count) is printed beside it
   so the picture can be checked.

## 6. Demo data

Every science story uses one of:

- **synthetic data**, generated in `stories/data.ts` with its ground truth written down, so
  the view can be checked against the answer it should give; or
- **a public, licensed dataset**, as a small excerpt with its source, accession, licence and
  the exact excerpt recorded next to it (for example OpenNeuro CC0, PhysioNet ODC-By, USGS
  public domain, Zenodo CC-BY), with attribution rendered in the story.

Never a recording of a person made on a private bench, and never a result that has not
been published. A story built on real data should show at least one case where the method
says *no*, as well as one where it says yes.

## 7. What does not go in this repository

This library is public. It holds **standard views, general methods and public data**. It
does not hold novel research, unpublished findings, or a new visualization technique that
could be productized or patented; those stay in the private repository they came from. See
`CLAUDE.md`.
