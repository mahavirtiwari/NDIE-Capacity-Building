# Process flow pack

`CBMS-process-flows.pdf` — twelve pages, A4 landscape, covering the applicant's
journey, a programme from raised to reported, who each kind of user is, roles and
permissions, and every letter the system sends.

It is generated, not drawn by hand, so it can be brought back into line when the
system changes rather than slowly becoming a description of a system that no
longer exists.

## Rebuilding it

From the repository root:

```
python docs/process-flows/src/build_pack.py
```

That writes `cbms-process-flows.html` beside this file. Then print it:

```
chrome --headless=new --no-pdf-header-footer ^
  --print-to-pdf="docs/process-flows/CBMS-process-flows.pdf" ^
  "file:///<full path>/docs/process-flows/cbms-process-flows.html"
```

Any browser that prints to PDF will do; the page size and margins are in
`_styles.css`, not in the command.

## What is where

| File | What it holds |
| --- | --- |
| `src/flowpack.py` | The drawing primitives: lanes, boxes, arrows, chips, envelopes |
| `src/flow_pages_1.py` | Cover, and the applicant's journey in two halves |
| `src/flow_pages_2.py` | The programme lifecycle, and what a report is made of |
| `src/flow_pages_3.py` | The delegation chain, the allocation axes, the three channels |
| `src/build_pack.py` | The page order, the permission matrix and the e-mail catalogue |
| `_styles.css` | Print styles — page size, margins, colours, tables |

## Keeping it true

The permission matrix in `build_pack.py` mirrors the seeded roles in
`DbSeeder.cs` after `RoleHierarchy` has had its say, and the e-mail catalogue
mirrors `EmailTemplateDefaults.cs`. Change either of those and this pack needs
the same change, or it starts telling people something that is not so.

A section that runs past one page silently becomes two, which is how a lane gets
split down the middle. After rebuilding, check the page count is still twelve.
