import { ReactNode } from "react";
import { ResumeBanner } from "@/components/ResumeBanner";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative">
      {/* Decorative background orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] rounded-full bg-tertiary/5 blur-[100px]"
          aria-hidden="true"
        />
      </div>

      <div className="min-h-screen flex items-center justify-center px-4 py-8 w-full">
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <ResumeBanner />
    </div>
  );
}
