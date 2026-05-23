"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row",
        month: "space-y-4 w-full",
        month_caption: "relative flex items-center justify-center pt-1",
        caption_label: "text-sm font-medium",
        nav: "flex items-start gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "absolute h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 z-10",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "absolute right-4 h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 z-10",
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex justify-between",
        weekday: "w-9 rounded-md text-[0.8rem] font-normal text-muted-foreground",
        week: "mt-2 flex w-full justify-between",
        day: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
        ),
        day_button: "h-9 w-9 p-0",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-muted text-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}
