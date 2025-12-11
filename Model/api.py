"""
Flask API for KSE-30 Stock Predictions - Hybrid Ensemble Version
LSTM + LightGBM + XGBoost Ensemble
Trained on 20+ years of historical data (2000-2025)
Final Year Project Implementation
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import pickle
import os
from datetime import datetime
import numpy as np
import pandas as pd
import json

# Import hybrid ensemble predictor
from kse_hybrid_ensemble import HybridEnsemblePredictor, create_hybrid_ensemble

app = Flask(__name__)
CORS(app)

# Global variables
predictor = None
MODEL_PATH = 'models/hybrid_ensemble'
CSV_PATH = 'kse30_historical_complete.csv'
METADATA_PATH = 'models/hybrid_ensemble/metadata.json'

KSE30_STOCKS = [
    'OGDC', 'PPL', 'POL', 'HUBC', 'ENGRO', 'FFC', 'EFERT', 'LUCK', 'MCB', 'UBL',
    'HBL', 'BAHL', 'MEBL', 'NBP', 'FABL', 'BAFL', 'DGKC', 'MLCF', 'FCCL', 'CHCC',
    'PSO', 'SHEL', 'ATRL', 'PRL', 'SYS', 'SEARL', 'ILP', 'TGL', 'INIL', 'PAEL'
]


def load_or_train_model(prediction_days=7, force_retrain=False):
    """Load existing hybrid ensemble or train new one"""
    global predictor
    
    # Try to load existing models (without CSV data - models only)
    if os.path.exists(MODEL_PATH) and not force_retrain and any(f.endswith('_lstm.h5') for f in os.listdir(MODEL_PATH)):
        try:
            print("Loading pre-trained hybrid ensemble models...")
            predictor = HybridEnsemblePredictor(prediction_days=prediction_days)
            predictor.load_models(MODEL_PATH)
            
            # Load metadata if available
            if os.path.exists(METADATA_PATH):
                with open(METADATA_PATH, 'r') as f:
                    metadata = json.load(f)
                    predictor.feature_cols = metadata.get('feature_cols', [])
                    predictor.lstm_sequence_length = metadata.get('lstm_sequence_length', 60)
                    print(f"  Loaded {len(predictor.feature_cols)} features from metadata")
            
            # Load only minimal data needed for predictions (latest prices + indicators)
            if os.path.exists(CSV_PATH):
                try:
                    print("Loading historical data for predictions...")
                    predictor.load_data(CSV_PATH)
                    print(f"✓ Hybrid ensemble loaded successfully")
                    print(f"  Models available: {len(predictor.models)}")
                    print(f"  Stocks available: {len(predictor.data_dict)}")
                except Exception as e:
                    print(f"⚠️  Warning: Could not load CSV data: {str(e)}")
                    print("  API will work for model info but not for predictions")
            
            return True
        except Exception as e:
            print(f"✗ Error loading models: {str(e)}")
            print("Will train new hybrid ensemble...")
    
    # Train new ensemble (requires CSV data)
    if not os.path.exists(CSV_PATH):
        print(f"✗ CSV file not found: {CSV_PATH}")
        print("Please ensure 'kse30_historical_complete.csv' is in the same directory as api.py")
        return False
    
    print(f"\n{'='*70}")
    print("TRAINING HYBRID ENSEMBLE ON HISTORICAL DATA")
    print(f"{'='*70}")
    print(f"CSV Path: {CSV_PATH}")
    print(f"Prediction Days: {prediction_days}")
    print("Training 3 sub-models: LSTM + LightGBM + XGBoost")
    print("This will take 30-60 minutes depending on data size...")
    print(f"{'='*70}\n")
    
    try:
        predictor = create_hybrid_ensemble(CSV_PATH, prediction_days=prediction_days)
        
        # Save models
        os.makedirs(MODEL_PATH, exist_ok=True)
        predictor.save_models(MODEL_PATH)
        
        # Save metadata (features and configuration)
        metadata = {
            'feature_cols': predictor.feature_cols,
            'lstm_sequence_length': predictor.lstm_sequence_length,
            'ensemble_weights': predictor.ensemble_weights,
            'prediction_days': predictor.prediction_days,
            'trained_at': datetime.now().isoformat()
        }
        with open(METADATA_PATH, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\n{'='*70}")
        print(f"✓ Hybrid ensemble trained and saved to {MODEL_PATH}")
        print(f"  Total ensembles: {len(predictor.models)}")
        print(f"  Features per model: {len(predictor.feature_cols)}")
        print(f"  Metadata saved: {METADATA_PATH}")
        print(f"{'='*70}")
        return True
    except Exception as e:
        print(f"\n{'='*70}")
        print(f"✗ Error training models: {str(e)}")
        print(f"{'='*70}")
        import traceback
        traceback.print_exc()
        return False


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/')
def home():
    """API documentation"""
    return jsonify({
        'message': 'KSE-30 Hybrid Ensemble Stock Prediction API',
        'version': '3.0',
        'description': 'Hybrid Ensemble Model - LSTM + LightGBM + XGBoost',
        'model_type': 'Ensemble of 3 different ML paradigms',
        'endpoints': {
            'GET /': 'API documentation (this page)',
            'GET /api/health': 'Check API status and model health',
            'GET /api/stocks': 'List all available stocks with details',
            'GET /api/predict/<ticker>': 'Get ensemble prediction for specific stock',
            'GET /api/predict/all': 'Get predictions for all stocks',
            'GET /api/recommendations?top_n=5': 'Get top buy/sell recommendations',
            'GET /api/model/info': 'Get detailed model metrics and ensemble info',
            'POST /api/train': 'Retrain ensemble models on latest data'
        },
        'example_usage': {
            'single_prediction': 'GET /api/predict/ATRL',
            'all_predictions': 'GET /api/predict/all',
            'top_5_recommendations': 'GET /api/recommendations?top_n=5',
            'model_details': 'GET /api/model/info'
        },
        'stock_tickers': sorted(KSE30_STOCKS),
        'model_details': {
            'sub_models': ['LSTM (Temporal)', 'LightGBM (Features)', 'XGBoost (Robust)'],
            'indicators': '50+ technical indicators',
            'features': '80+ engineered features',
            'training_data': '20+ years (2000-2025)',
            'lstm_sequence': '60 days',
            'cv_method': '5-fold time series cross-validation',
            'ensemble_method': 'Weighted voting with agreement metric'
        }
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    """Check API and model health"""
    status = {
        'status': 'healthy' if predictor is not None else 'not_ready',
        'timestamp': datetime.now().isoformat(),
        'model_version': '3.0 - Hybrid Ensemble',
        'models_loaded': len(predictor.models) if predictor else 0,
        'stocks_available': len(predictor.data_dict) if predictor else 0,
        'prediction_days': predictor.prediction_days if predictor else None,
    }
    
    if predictor:
        status['available_tickers'] = sorted(predictor.models.keys())
        
        # Ensemble performance summary
        lstm_r2 = [m['metrics'].get('lstm_r2', 0) for m in predictor.models.values()]
        lgb_r2 = [m['metrics'].get('lgb_r2', 0) for m in predictor.models.values()]
        xgb_r2 = [m['metrics'].get('xgb_r2', 0) for m in predictor.models.values()]
        
        status['ensemble_performance'] = {
            'lstm_avg_r2': round(np.mean(lstm_r2), 4),
            'lgb_avg_r2': round(np.mean(lgb_r2), 4),
            'xgb_avg_r2': round(np.mean(xgb_r2), 4),
            'ensemble_avg_r2': round(np.mean([np.mean([l, g, x]) for l, g, x in zip(lstm_r2, lgb_r2, xgb_r2)]), 4)
        }
    
    return jsonify(status)


@app.route('/api/stocks', methods=['GET'])
def list_stocks():
    """List all available stocks with detailed information"""
    if predictor is None:
        return jsonify({'error': 'Models not loaded. Please wait or contact admin.'}), 503
    
    stocks_info = []
    
    for ticker in sorted(KSE30_STOCKS):
        info = {'ticker': ticker}
        
        if ticker in predictor.data_dict:
            df = predictor.data_dict[ticker]
            info['status'] = 'available'
            info['records'] = len(df)
            info['years_of_data'] = round((df['Date'].max() - df['Date'].min()).days / 365.25, 1)
            info['date_range'] = {
                'from': df['Date'].min().strftime('%Y-%m-%d'),
                'to': df['Date'].max().strftime('%Y-%m-%d')
            }
            info['current_price'] = float(df['Close'].iloc[-1])
            info['price_range'] = {
                'min': float(df['Close'].min()),
                'max': float(df['Close'].max()),
                '52week_low': float(df['Close'].tail(252).min()),
                '52week_high': float(df['Close'].tail(252).max())
            }
            info['model_trained'] = ticker in predictor.models
            
            if ticker in predictor.models:
                metrics = predictor.models[ticker]['metrics']
                info['ensemble_metrics'] = {
                    'lstm_r2': round(metrics.get('lstm_r2', 0), 4),
                    'lgb_r2': round(metrics.get('lgb_r2', 0), 4),
                    'xgb_r2': round(metrics.get('xgb_r2', 0), 4),
                    'ensemble_avg_r2': round((metrics.get('lstm_r2', 0) + metrics.get('lgb_r2', 0) + metrics.get('xgb_r2', 0)) / 3, 4),
                }
        else:
            info['status'] = 'unavailable'
            info['model_trained'] = False
        
        stocks_info.append(info)
    
    return jsonify({
        'total_stocks': len(KSE30_STOCKS),
        'available_stocks': len(predictor.data_dict),
        'trained_ensembles': len(predictor.models),
        'stocks': stocks_info,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/predict/<ticker>', methods=['GET'])
def predict_stock(ticker):
    """Get hybrid ensemble prediction for specific stock"""
    ticker = ticker.upper()
    
    # Validation
    if predictor is None:
        return jsonify({'error': 'Models not loaded. Please wait or contact admin.'}), 503
    
    if ticker not in KSE30_STOCKS:
        return jsonify({
            'error': f'Invalid ticker: {ticker}',
            'valid_tickers': sorted(KSE30_STOCKS)
        }), 400
    
    if ticker not in predictor.data_dict:
        return jsonify({'error': f'Data not available for {ticker}'}), 404
    
    if ticker not in predictor.models:
        return jsonify({'error': f'Ensemble not trained for {ticker}'}), 404
    
    # Get prediction
    try:
        prediction = predictor.predict(ticker)
        
        if 'error' in prediction:
            return jsonify({'error': prediction['error']}), 500
        
        return jsonify({
            'success': True,
            'data': prediction,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': f'Prediction failed: {str(e)}'}), 500


@app.route('/api/predict/all', methods=['GET'])
def predict_all_stocks():
    """Get hybrid ensemble predictions for all stocks"""
    if predictor is None:
        return jsonify({'error': 'Models not loaded'}), 503
    
    try:
        predictions = predictor.predict_all()
        
        # Separate by signal type
        buy_signals = []
        hold_signals = []
        sell_signals = []
        errors = []
        
        for ticker, pred in predictions.items():
            if 'error' in pred:
                errors.append(pred)
            elif pred['signal'] == 'BUY':
                buy_signals.append(pred)
            elif pred['signal'] == 'SELL':
                sell_signals.append(pred)
            else:
                hold_signals.append(pred)
        
        # Sort by confidence
        buy_signals.sort(key=lambda x: x['confidence'], reverse=True)
        sell_signals.sort(key=lambda x: x['confidence'], reverse=True)
        hold_signals.sort(key=lambda x: x['confidence'], reverse=True)
        
        # Calculate statistics
        all_valid = buy_signals + sell_signals + hold_signals
        confidences = [p['confidence'] for p in all_valid]
        returns = [p['predicted_return'] for p in all_valid]
        agreements = [p.get('ensemble_agreement', 50) for p in all_valid]
        
        return jsonify({
            'success': True,
            'summary': {
                'total_stocks': len(predictions),
                'buy_signals': len(buy_signals),
                'hold_signals': len(hold_signals),
                'sell_signals': len(sell_signals),
                'errors': len(errors),
                'success_rate': round(len(all_valid) / len(predictions) * 100, 2)
            },
            'statistics': {
                'confidence': {
                    'mean': round(np.mean(confidences), 2),
                    'min': round(min(confidences), 2),
                    'max': round(max(confidences), 2),
                    'std': round(np.std(confidences), 2)
                },
                'predicted_returns': {
                    'mean': round(np.mean(returns), 2),
                    'min': round(min(returns), 2),
                    'max': round(max(returns), 2)
                },
                'ensemble_agreement': {
                    'mean': round(np.mean(agreements), 2),
                    'min': round(min(agreements), 2),
                    'max': round(max(agreements), 2)
                }
            },
            'predictions': {
                'buy': buy_signals,
                'hold': hold_signals,
                'sell': sell_signals
            },
            'errors': errors if errors else None,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': f'Batch prediction failed: {str(e)}'}), 500


@app.route('/api/recommendations', methods=['GET'])
def get_recommendations():
    """Get top buy/sell recommendations with ensemble metrics"""
    if predictor is None:
        return jsonify({'error': 'Models not loaded'}), 503
    
    top_n = request.args.get('top_n', default=5, type=int)
    top_n = max(1, min(top_n, 15))
    
    try:
        recommendations = predictor.get_top_recommendations(top_n=top_n)
        
        return jsonify({
            'success': True,
            'top_n': top_n,
            'data': recommendations,
            'summary': {
                'total_buys': len(recommendations['top_buys']),
                'total_sells': len(recommendations['top_sells'])
            },
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': f'Failed to get recommendations: {str(e)}'}), 500


@app.route('/api/train', methods=['POST'])
def retrain_models():
    """
    Retrain all ensemble models on latest data
    WARNING: This will take 30-60 minutes
    """
    try:
        data = request.get_json() or {}
        prediction_days = data.get('prediction_days', 7)
        
        if not isinstance(prediction_days, int) or prediction_days < 1 or prediction_days > 30:
            return jsonify({'error': 'prediction_days must be between 1 and 30'}), 400
        
        print(f"\nReceived retrain request: prediction_days={prediction_days}")
        
        success = load_or_train_model(prediction_days=prediction_days, force_retrain=True)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Hybrid ensemble retrained successfully',
                'ensembles_trained': len(predictor.models),
                'stocks_loaded': len(predictor.data_dict),
                'prediction_days': predictor.prediction_days,
                'features': len(predictor.feature_cols),
                'sub_models': ['LSTM', 'LightGBM', 'XGBoost'],
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'error': 'Training failed. Check server logs.'}), 500
    
    except Exception as e:
        return jsonify({'error': f'Training failed: {str(e)}'}), 500


@app.route('/api/model/info', methods=['GET'])
def model_info():
    """Get detailed hybrid ensemble information"""
    if predictor is None:
        return jsonify({'error': 'Models not loaded'}), 503
    
    model_details = {}
    
    for ticker, ensemble in predictor.models.items():
        metrics = ensemble['metrics']
        
        model_details[ticker] = {
            'lstm_r2': round(metrics.get('lstm_r2', 0), 4),
            'lgb_r2': round(metrics.get('lgb_r2', 0), 4),
            'xgb_r2': round(metrics.get('xgb_r2', 0), 4),
            'ensemble_avg_r2': round((metrics.get('lstm_r2', 0) + metrics.get('lgb_r2', 0) + metrics.get('xgb_r2', 0)) / 3, 4),
            'lgb_mae': round(metrics.get('lgb_mae', 0), 2),
            'xgb_mae': round(metrics.get('xgb_mae', 0), 2),
            'data_points': len(predictor.data_dict[ticker]),
            'date_range': {
                'from': predictor.data_dict[ticker]['Date'].min().strftime('%Y-%m-%d'),
                'to': predictor.data_dict[ticker]['Date'].max().strftime('%Y-%m-%d')
            },
            'ensemble_weights': {
                'lstm': predictor.ensemble_weights[0],
                'lightgbm': predictor.ensemble_weights[1],
                'xgboost': predictor.ensemble_weights[2]
            }
        }
    
    return jsonify({
        'success': True,
        'model_version': '3.0 - Hybrid Ensemble',
        'prediction_days': predictor.prediction_days,
        'total_ensembles': len(predictor.models),
        'feature_count': len(predictor.feature_cols),
        'features': sorted(predictor.feature_cols),
        'lstm_config': {
            'sequence_length': predictor.lstm_sequence_length,
            'layers': '2 Bidirectional LSTM',
            'units': [128, 64],
            'dropout': 0.2
        },
        'lightgbm_config': {
            'num_trees': 2000,
            'num_leaves': 60,
            'learning_rate': 0.02,
            'regularization': {'l1': 0.8, 'l2': 0.8}
        },
        'xgboost_config': {
            'num_trees': 1500,
            'max_depth': 9,
            'learning_rate': 0.025,
            'regularization': {'alpha': 0.8, 'lambda': 0.8}
        },
        'training_method': '5-fold time series cross-validation',
        'ensemble_voting': 'Weighted average with ensemble agreement metric',
        'models': model_details,
        'timestamp': datetime.now().isoformat()
    })


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


# ============================================================================
# INITIALIZATION
# ============================================================================

def initialize_api():
    """Initialize API on startup"""
    print("\n" + "="*70)
    print("KSE-30 HYBRID ENSEMBLE STOCK PREDICTION API")
    print("="*70)
    print("Version: 3.0 - Hybrid Ensemble Model")
    print("Sub-models: LSTM + LightGBM + XGBoost")
    print("Trained on: 20+ years of historical data (2000-2025)")
    print("="*70 + "\n")
    
    # Check if CSV exists
    if not os.path.exists(CSV_PATH):
        print(f"⚠️  WARNING: CSV file not found at: {CSV_PATH}")
        print("Please ensure 'kse30_historical_complete.csv' is in the same directory as api.py")
        print("Attempted path: {}\n".format(os.path.abspath(CSV_PATH)))
        return False
    
    print(f"✓ Found CSV file: {CSV_PATH}")
    
    # Load or train models
    success = load_or_train_model(prediction_days=7)
    
    if success:
        print("\n" + "="*70)
        print("✓ API READY TO SERVE REQUESTS")
        print("="*70)
        print(f"Ensembles loaded: {len(predictor.models)}")
        print(f"Stocks available: {len(predictor.data_dict)}")
        print(f"Prediction horizon: {predictor.prediction_days} days")
        print(f"Features per model: {len(predictor.feature_cols)}")
        print(f"Sub-models: LSTM (Temporal) + LightGBM (Features) + XGBoost (Robust)")
        print("="*70 + "\n")
    else:
        print("\n" + "="*70)
        print("⚠️  API INITIALIZATION FAILED")
        print("="*70)
        print("The API will start but won't be able to serve predictions.")
        print("Please check the error messages above.")
        print("="*70 + "\n")
    
    return success


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == '__main__':
    # Initialize API
    initialize_api()
    
    # Run server
    print("Starting Flask server...")
    print("="*70)
    print("API Endpoints:")
    print("  - Documentation:       http://localhost:5000")
    print("  - Health Check:        http://localhost:5000/api/health")
    print("  - List Stocks:         http://localhost:5000/api/stocks")
    print("  - Single Prediction:   http://localhost:5000/api/predict/ATRL")
    print("  - All Predictions:     http://localhost:5000/api/predict/all")
    print("  - Recommendations:     http://localhost:5000/api/recommendations?top_n=5")
    print("  - Model Info:          http://localhost:5000/api/model/info")
    print("="*70)
    print("\nPress CTRL+C to stop the server\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)