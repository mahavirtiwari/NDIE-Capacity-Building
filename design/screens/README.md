# Screen sheets

Every screen of both mobile apps, one SVG per app.

| File | Screens |
|---|---|
| `applicant-app-screens.svg` | 11 — launch, sign in, register, verify, the five tabs, the registration form, an application |
| `coordinator-app-screens.svg` | 15 — launch, sign in, workshops, the four tabs, and the eight capture screens |

## Where the content comes from

The labels, placeholders, button text and empty states are lifted from the
screen source, not written for the drawing. A frame that disagrees with the app
is a fault in one of the two rather than a difference of opinion about what it
ought to say — which is the only way a sheet like this stays worth looking at
once the app moves on.

Each frame is captioned with its route, so `app/workshop/[id]/venue.tsx` under a
frame is the file that draws it.

The data in them is invented: names, dates, counts. The structure is not.

## Regenerating

```powershell
cd design\screens
python applicant.py
python coordinator.py
```

`gen.py` holds the phone frame and the elements — field, select, button, card,
row, photo box, chips, toggle, tab bar. The two app files are just a list of
screens built from those, so adding a screen is a function and a line.

Nothing here is used at build or run time. It is documentation.

## What it is not

Not a design system, and not a specification for how the apps should look —
they already look how they look, and this follows them. For a change to the
apps, change the screen and regenerate.
