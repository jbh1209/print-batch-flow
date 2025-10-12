import impressLogo from "@/assets/impress-logo.png";

export const ProofViewerHeader = () => {
  return (
    <header className="w-full bg-[#00B8D4] px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        <img 
          src={impressLogo} 
          alt="Impress Print Logo" 
          className="h-8 w-auto"
        />
        <h1 className="text-white text-xl font-semibold">
          Impress Print - Online Approval System
        </h1>
      </div>
    </header>
  );
};
