import impressLogo from "@/assets/impress-logo-colour.png";

interface ProofViewerHeaderProps {
  woNumber?: string;
  contact?: string;
}

export const ProofViewerHeader = ({ woNumber, contact }: ProofViewerHeaderProps) => {
  return (
    <header className="w-full bg-[#00B8D4] px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img 
            src={impressLogo} 
            alt="Impress Print Logo" 
            className="h-10 w-auto"
          />
          <div>
            <h1 className="text-white text-xl font-semibold">
              Online Approval System
            </h1>
            {(woNumber || contact) && (
              <p className="text-white/90 text-sm">
                {woNumber && `WO: ${woNumber}`}
                {woNumber && contact && " • "}
                {contact && `Client: ${contact}`}
              </p>
            )}
          </div>
        </div>
        <img 
          src={impressLogo} 
          alt="Impress Print" 
          className="h-8 w-auto opacity-60"
        />
      </div>
    </header>
  );
};
