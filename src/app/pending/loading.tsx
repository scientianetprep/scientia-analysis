export default function PendingLoading() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="surface-card p-6 flex flex-col items-center gap-3 max-w-sm w-full">
        <div className="w-10 h-10 rounded-md bg-surface-container-high border border-outline-variant/20 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-tertiary border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-base font-poppins font-semibold text-on-surface">
            Verifying access
          </h2>
          <p className="text-sm text-on-surface-variant">
            Preparing your experience…
          </p>
        </div>
      </div>
    </div>
  );
}
