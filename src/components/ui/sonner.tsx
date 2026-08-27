"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
// [2026-02-26] Eliminado useTheme de next-themes porque no hay ThemeProvider
// y causaba crash en prerender de /_global-error (useContext null)
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {

  return (
    <Sonner
      theme={"light" as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        duration: 4200,
        classNames: {
          toast: "!rounded-2xl !border !bg-white/95 !shadow-[0_18px_45px_rgba(15,23,42,0.18)] !backdrop-blur-md",
          title: "!text-sm !font-semibold !text-slate-900",
          description: "!text-xs !leading-relaxed !text-slate-500",
          success: "!border-emerald-200 !bg-[#effff4]",
          error: "!border-rose-200 !bg-[#fff3f2]",
          warning: "!border-amber-200 !bg-[#fff8e6]",
          info: "!border-sky-200 !bg-[#f0f8ff]",
          icon: "!mr-1",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
