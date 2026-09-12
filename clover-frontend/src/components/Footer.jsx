/**
 * Footer.jsx — glassy footer with CLOVER brand and data source credits.
 */
function Footer() {
  return (
    <footer className="glass-header py-8 mt-12 text-slate-500 text-xs">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl glass-subtle flex items-center justify-center text-emerald-700 font-bold text-sm">
            🍀
          </div>
          <div>
            <div className="font-bold text-slate-800">CLOVER Atmospheric Sensing &amp; Air Quality System</div>
            <div className="text-[11px] text-slate-500">
              Continuous multimodal boundary layer and particulate forecasting &bull; Greater Noida &amp; Delhi NCR
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
          <span>Continuous Telemetry</span>
          <span>&bull;</span>
          <span>National Standards (CPCB / NAAQS)</span>
          <span>&bull;</span>
          <span>WHO 2021 Benchmarks</span>
        </div>

      </div>
    </footer>
  );
}

window.Footer = Footer;
