import impressLogo from "@/assets/impress-logo-colour.png";

interface ProofViewerHeaderProps {
  woNumber?: string;
  contact?: string;
  reference?: string;
  qty?: number;
}

export const ProofViewerHeader = ({ woNumber, contact, reference, qty }: ProofViewerHeaderProps) => {
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
            {(woNumber || contact || reference) && (
              <div className="text-white/90 text-sm space-y-0.5">
                {woNumber && (
                  <p className="font-medium">WO: {woNumber}</p>
                )}
                {contact && (
                  <p>Client: {contact}</p>
                )}
                {reference && (
                  <p>Reference: {reference}</p>
                )}
                {qty && (
                  <p>Quantity: {qty}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
