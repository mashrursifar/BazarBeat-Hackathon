# Crop Sample Evaluation Photos (`apps/api/src/seed/assets/samples/`)

This directory holds the 5 crops × 3 grades × 5 samples dataset (75 real produce photos) ingested by `ai-eval/`.

## Directory Structure & Naming Conventions

For each crop, provide 5 photos for **Grade A**, 5 photos for **Grade B**, and 5 photos for **Grade C**:

```
apps/api/src/seed/assets/samples/
├── onion/
│   ├── A_1.jpg, A_2.jpg, A_3.jpg, A_4.jpg, A_5.jpg   (or A1.jpg..A5.jpg, or A/1.jpg..A/5.jpg)
│   ├── B_1.jpg, B_2.jpg, B_3.jpg, B_4.jpg, B_5.jpg   (or B1.jpg..B5.jpg, or B/1.jpg..B/5.jpg)
│   └── C_1.jpg, C_2.jpg, C_3.jpg, C_4.jpg, C_5.jpg   (or C1.jpg..C5.jpg, or C/1.jpg..C/5.jpg)
├── green-chilli/
│   ├── A_1.jpg ... A_5.jpg
│   ├── B_1.jpg ... B_5.jpg
│   └── C_1.jpg ... C_5.jpg
├── bitter-gourd/ (or bitter-groud/)
│   ├── A_1.jpg ... A_5.jpg
│   ├── B_1.jpg ... B_5.jpg
│   └── C_1.jpg ... C_5.jpg
├── eggplant/
│   ├── A_1.jpg ... A_5.jpg
│   ├── B_1.jpg ... B_5.jpg
│   └── C_1.jpg ... C_5.jpg
└── potato/
    ├── A_1.jpg ... A_5.jpg
    ├── B_1.jpg ... B_5.jpg
    └── C_1.jpg ... C_5.jpg
```

## How the Split Works

For each crop and grade (5 photos):
- Photos 1, 2, 3 (`v1`..`v3`) are assigned to the **`dev`** split (used for prompt engineering and iterative tuning).
- Photos 4, 5 (`v4`..`v5`) are assigned to the **`test`** split (held-out, frozen until final benchmarking).

## Ingestion Command

Whenever you add or replace photos in this directory, run:
```bash
npm run eval:dataset
```
This automatically updates `ai-eval/manifest.json` and populates `ai-eval/images/`.
