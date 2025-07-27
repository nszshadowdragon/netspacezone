// CometModalErrorBoundary.jsx
import React from 'react';

export default class CometModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CometModalErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: 'red', color: 'white' }}>
          <h2>Something went wrong in CometModal.</h2>
          <p>Please check the console for details.</p>
          {this.state.error && (
            <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.toString()}</pre>
          )}
          {this.state.errorInfo && (
            <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.errorInfo.componentStack}</pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
