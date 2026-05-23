"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DateFilterPopover({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}>) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="justify-between rounded-lg border-border bg-white px-4 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4" />
            {selectedDate ? format(selectedDate, "PPP") : label}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto min-w-[300px] rounded-xl border border-border bg-white p-0"
      >
        <div className="border-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              onChange(date ? format(date, "yyyy-MM-dd") : null);
              if (date) {
                setOpen(false);
              }
            }}
          />
        </div>
        {value ? (
          <div className="flex justify-end border-t px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <X className="size-4" />
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
