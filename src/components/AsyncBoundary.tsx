import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; label: string; onExit?: () => void };
type State = { failed: boolean };

export default class AsyncBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo): void { /* The recovery UI remains available offline. */ }
  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return <section className="async-error" role="alert">
      <h2>Không tải được {this.props.label}</h2>
      <p>Dữ liệu chưa tải đủ hoặc kết nối vừa bị gián đoạn. Kết quả đã lưu trên thiết bị vẫn được giữ.</p>
      <div className="async-error-actions">
        {this.props.onExit && <button type="button" className="button outline" onClick={this.props.onExit}>Thoát về màn hình chính</button>}
        <button type="button" className="button primary" onClick={() => window.location.reload()}>Tải lại ứng dụng</button>
      </div>
    </section>;
  }
}
