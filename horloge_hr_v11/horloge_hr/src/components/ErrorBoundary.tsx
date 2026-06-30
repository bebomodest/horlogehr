import React from 'react';
import { Footer } from './Footer';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onBack?: () => void;
  pageName?: string;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMsg: msg };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMsg: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] font-sans">
          <main className="flex-1 flex items-center justify-center px-6 py-12">
            <div className="bg-white/70 backdrop-blur-md rounded-3xl p-10 shadow-xl border border-white/60 flex flex-col items-center text-center max-w-md w-full gap-6">
              <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center">
                <AlertCircle size={40} className="text-[#76151e]" />
              </div>
              <h2 className="text-2xl font-black text-[#3a2a1f]">
                حدث خطأ في {this.props.pageName ?? 'الصفحة'}
              </h2>
              <p className="text-[#7a6a5f] font-bold text-sm leading-relaxed">
                لم تتمكن الصفحة من التحميل. يمكنك الرجوع للصفحة السابقة أو إعادة المحاولة.
              </p>
              {this.state.errorMsg ? (
                <p className="text-xs text-red-400 font-mono bg-red-50 rounded-xl px-3 py-2 w-full text-right break-all">
                  {this.state.errorMsg}
                </p>
              ) : null}
              <div className="flex gap-3 w-full">
                {this.props.onBack && (
                  <button
                    onClick={this.props.onBack}
                    className="flex-1 py-3 rounded-xl bg-[#3a2a1f] text-white font-black hover:bg-[#76151e] transition-all"
                  >
                    رجوع
                  </button>
                )}
                <button
                  onClick={this.handleRetry}
                  className="flex-1 py-3 rounded-xl bg-white border border-[#d4c4b7] text-[#3a2a1f] font-black hover:bg-[#f0ebe3] transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} />
                  إعادة المحاولة
                </button>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      );
    }

    return this.props.children;
  }
}
