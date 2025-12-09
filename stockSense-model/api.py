"""
Flask API for KSE-30 Stock Predictions - Advanced Version
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

# Import advanced predictor
from kse_stock_model import KSEStockPredictor, create_advanced_predictor

app = Flask(__name__)
CORS(app)

# Global variables
predictor = None
MODEL_PATH = 'models/kse_advanced_predictor.pkl'
CSV_PATH = 'kse30_historical_complete.csv'  # Historical data from 2000 onwards

KSE30_STOCKS = [
    'OGDC', 'PPL', 'POL', 'HUBC', 'ENGRO', 'FFC', 'EFERT', 'LUCK', 'MCB', 'UBL',
    'HBL', 'BAHL', 'MEBL', 'NBP', 'FABL', 'BAFL', 'DGKC', 'MLCF', 'FCCL', 'CHCC',
    'PSO', 'SHEL', 'ATRL', 'PRL', 'SYS', 'SEARL', 'ILP', 'TGL', 'INIL', 'PAEL'
]


def load_or_train_model(prediction_days=7, force_retrain=False):
    """Load existing advanced model or train new one on historical data"""
    global predictor
    
    # Try to load existing model
    if os.path.exists(MODEL_PATH) and not force_retrain:
        try:
            print("Loading pre-trained advanced model...")
            with open(MODEL_PATH, 'rb') as f:
                predictor = pickle.load(f)
            print("✓ Model loaded successfully")
            print(f"  Models available: {len(predictor.models)}")
            print(f"  Stocks available: {len(predictor.data_dict)}")
            print(f"  Prediction days: {predictor.prediction_days}")
            return True
        except Exception as e:
            print(f"✗ Error loading model: {str(e)}")
            print("Will train new advanced model...")
    
    # Train new advanced model
    if not os.path.exists(CSV_PATH):
        print(f"✗ CSV file not found: {CSV_PATH}")
        print("Please ensure 'kse30_historical_complete.csv' is in the same directory as api.py")
        return False
    
    print(f"\n{'='*70}")
    print("TRAINING ADVANCED MODEL ON HISTORICAL DATA")
    print(f"{'='*70}")
    print(f"CSV Path: {CSV_PATH}")
    print(f"Prediction Days: {prediction_days}")
    print("Training on 20+ years of KSE-30 data...")
    print("This will take 5-15 minutes depending on data size...")
    print(f"{'='*70}\n")
    
    try:
        predictor = create_advanced_predictor(CSV_PATH, prediction_days=prediction_days)
        
        # Save model
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump(predictor, f)
        
        print(f"\n{'='*70}")
        print(f"✓ Advanced models trained and saved to {MODEL_PATH}")
        print(f"  Total models: {len(predictor.models)}")
        print(f"  Features per model: {len(predictor.feature_cols)}")
        print(f"{'='*70}")
        return True
    except Exception as e:
        print(f"\n{'='*70}")
        print(f"✗ Error training models: {str(e)}")
        print(f"{'='*70}")
        return False


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/')
def home():
    """API documentation"""
    return jsonify({
        'message': 'KSE-30 Advanced Stock Prediction API',
        'version': '2.0',
        'description': 'Advanced ML Model - Trained on 20+ years of historical data (2000-2025)',
        'model_type': 'LightGBM with 50+ technical indicators',
        'endpoints': {
            'GET /': 'API documentation (this page)',
            'GET /api/health': 'Check API status and model health',
            'GET /api/stocks': 'List all available stocks with details',
            'GET /api/predict/<ticker>': 'Get advanced prediction for specific stock',
            'GET /api/predict/all': 'Get predictions for all stocks',
            'GET /api/recommendations?top_n=5': 'Get top buy/sell recommendations',
            'GET /api/model/info': 'Get detailed model metrics and feature importance',
            'POST /api/train': 'Retrain models on latest data'
        },
        'example_usage': {
            'single_prediction': 'GET /api/predict/ATRL',
            'all_predictions': 'GET /api/predict/all',
            'top_5_recommendations': 'GET /api/recommendations?top_n=5',
            'model_details': 'GET /api/model/info'
        },
        'stock_tickers': sorted(KSE30_STOCKS),
        'model_details': {
            'indicators': '50+ technical indicators',
            'features': '80+ engineered features',
            'training_data': '20+ years (2000-2025)',
            'cv_folds': '10-fold time series cross-validation',
            'boost_rounds': '2000 with early stopping'
        }
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    """Check API and model health"""
    status = {
        'status': 'healthy' if predictor is not None else 'not_ready',
        'timestamp': datetime.now().isoformat(),
        'model_version': '2.0 - Advanced',
        'models_loaded': len(predictor.models) if predictor else 0,
        'stocks_available': len(predictor.data_dict) if predictor else 0,
        'prediction_days': predictor.prediction_days if predictor else None,
    }
    
    if predictor:
        status['available_tickers'] = sorted(predictor.models.keys())
        
        # Model performance summary
        r2_scores = [m['metrics']['r2'] for m in predictor.models.values()]
        mape_scores = [m['metrics']['mape'] for m in predictor.models.values()]
        
        status['model_performance'] = {
            'avg_r2': round(np.mean(r2_scores), 4),
            'avg_mape': round(np.mean(mape_scores), 4),
            'best_r2': round(max(r2_scores), 4),
            'best_mape': round(min(mape_scores), 4)
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
                info['model_metrics'] = {
                    'r2_score': round(metrics['r2'], 4),
                    'mape': round(metrics['mape'], 4),
                    'mae': round(metrics['mae'], 2),
                    'rmse': round(metrics['rmse'], 2)
                }
        else:
            info['status'] = 'unavailable'
            info['model_trained'] = False
        
        stocks_info.append(info)
    
    return jsonify({
        'total_stocks': len(KSE30_STOCKS),
        'available_stocks': len(predictor.data_dict),
        'trained_models': len(predictor.models),
        'stocks': stocks_info,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/predict/<ticker>', methods=['GET'])
def predict_stock(ticker):
    """Get advanced prediction for specific stock"""
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
        return jsonify({'error': f'Model not trained for {ticker}'}), 404
    
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
    """Get advanced predictions for all stocks"""
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
    """Get top buy/sell recommendations with advanced metrics"""
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
    Retrain all models on latest historical data
    WARNING: This will take 5-15 minutes
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
                'message': 'Advanced models retrained successfully',
                'models_trained': len(predictor.models),
                'stocks_loaded': len(predictor.data_dict),
                'prediction_days': predictor.prediction_days,
                'features': len(predictor.feature_cols),
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'error': 'Training failed. Check server logs.'}), 500
    
    except Exception as e:
        return jsonify({'error': f'Training failed: {str(e)}'}), 500


@app.route('/api/model/info', methods=['GET'])
def model_info():
    """Get detailed model information and feature importance"""
    if predictor is None:
        return jsonify({'error': 'Models not loaded'}), 503
    
    model_details = {}
    
    for ticker, model_data in predictor.models.items():
        feature_importance = model_data.get('feature_importance', pd.DataFrame()).to_dict('records')[:10] if 'feature_importance' in model_data else []
        
        model_details[ticker] = {
            'metrics': {
                'r2': round(model_data['metrics']['r2'], 4),
                'mape': round(model_data['metrics']['mape'], 4),
                'mae': round(model_data['metrics']['mae'], 2),
                'rmse': round(model_data['metrics']['rmse'], 2)
            },
            'data_points': len(predictor.data_dict[ticker]),
            'date_range': {
                'from': predictor.data_dict[ticker]['Date'].min().strftime('%Y-%m-%d'),
                'to': predictor.data_dict[ticker]['Date'].max().strftime('%Y-%m-%d')
            },
            'top_features': feature_importance
        }
    
    return jsonify({
        'success': True,
        'model_version': '2.0 - Advanced',
        'prediction_days': predictor.prediction_days,
        'total_models': len(predictor.models),
        'feature_count': len(predictor.feature_cols),
        'features': sorted(predictor.feature_cols),
        'training_method': '10-fold time series cross-validation',
        'boost_rounds': '2000 with early stopping',
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
    print("KSE-30 ADVANCED STOCK PREDICTION API")
    print("="*70)
    print("Version: 2.0 - Advanced ML Model")
    print("Trained on: 20+ years of historical data (2000-2025)")
    print("="*70 + "\n")
    
    # Check if CSV exists
    if not os.path.exists(CSV_PATH):
        print(f"⚠️  WARNING: CSV file not found at: {CSV_PATH}")
        print("Please ensure 'kse30_historical_complete.csv' is in the same directory as api.py")
        print("Attempted path: {}\n".format(os.path.abspath(CSV_PATH)))
        return False
    
    print(f"✓ Found CSV file: {CSV_PATH}")
    
    # Load or train model
    success = load_or_train_model(prediction_days=7)
    
    if success:
        print("\n" + "="*70)
        print("✓ API READY TO SERVE REQUESTS")
        print("="*70)
        print(f"Models loaded: {len(predictor.models)}")
        print(f"Stocks available: {len(predictor.data_dict)}")
        print(f"Prediction horizon: {predictor.prediction_days} days")
        print(f"Features per model: {len(predictor.feature_cols)}")
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
# INITIALIZE ON IMPORT (for Gunicorn/Render)
# ============================================================================
initialize_api()


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