import { RefreshCw } from "lucide-react";

export function MarketRefreshButton() {
  return (
    <div className="market-refresh">
      <a
        className="market-refresh__button"
        href="https://github.com/KANNOHI1/invenstment/actions/workflows/dashboard-pages.yml"
      >
        <RefreshCw size={15} />
        <span>Actionsで更新</span>
      </a>
      <span className="market-refresh__message">GitHub Pages版はActionsの再ビルドで更新</span>
    </div>
  );
}
