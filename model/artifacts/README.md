# TFT Model Artifacts

This directory contains trained model weights and metadata downloaded from Kaggle after training.

## Files

- `tft_model.ckpt` — PyTorch Lightning checkpoint with all model weights (~50-150 MB)
- `training_dataset.pkl` — Serialized TimeSeriesDataSet from training (used as template for inference)
- `scaler_params.json` — Per-ticker normalization parameters (mean/std for Close price)
- `encoder_params.json` — Categorical label encoder mappings (Ticker, Sector, announcement_type)
- `training_metadata.json` — Training hyperparameters and metadata

## How to Get These Files

1. Train the model on Kaggle using `notebooks/tft_training_kaggle.ipynb`
2. Download all artifacts from Kaggle's notebook output panel
3. Save them here
4. Commit to git (or add to .gitignore if they're too large)

## Model Architecture

- Encoder length: 90 trading days
- Decoder length: 7 days
- Target: Close price per ticker
- Loss: Quantile loss (quantiles: 0.1, 0.25, 0.5, 0.75, 0.9)
- Training data: 2008-01-01 to 2023-12-31 (30 tickers, 30 features)

## Inference

Once artifacts are in place, daily inference can be run:

```bash
python -m tft.daily_pipeline
```

This will:
1. Update master CSV with latest scraper data
2. Load frozen model and run predictions
3. Generate BUY/HOLD/SELL signals
4. Save signals to `data/inference/signals_YYYYMMDD.json`
