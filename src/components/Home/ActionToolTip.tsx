import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LucideIcon } from "lucide-react";

interface TooltipItemProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  isNew?: boolean;
  closeMenu?: () => void;
}

interface Position {
  x: number;
  y: number;
  isLeft?: boolean;
}

interface ActionTooltipProps {
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  position: Position;
  selected: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

export const ActionTooltip: React.FC<ActionTooltipProps> = ({
  children,
  isOpen,
  setIsOpen,
  position,
  selected,
  buttonRef,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSide, setTooltipSide] = useState<"left" | "right">("right");
  const [tooltipPosition, setTooltipPosition] = useState<"bottom" | "top">(
    "bottom",
  );

  useLayoutEffect(() => {
    if (isOpen && tooltipRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const buttonRect = buttonRef.current?.getBoundingClientRect();

      if (!buttonRect) return;

      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceRight = window.innerWidth - buttonRect.right;
      const tooltipHeight = tooltipRect.height;

      if (spaceBelow < tooltipHeight && buttonRect.top > tooltipHeight) {
        setTooltipPosition("top");
      } else {
        setTooltipPosition("bottom");
      }

      if (spaceRight < tooltipRect.width) {
        setTooltipSide("left");
      } else {
        setTooltipSide("right");
      }
    }
  }, [isOpen, position, buttonRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current?.contains(event.target as Node)) {
        return;
      }

      if (buttonRef.current?.contains(event.target as Node)) {
        return;
      }

      const isClickInAppArea = (event.target as Element)?.closest(
        ".flex.flex-col.h-screen",
      );
      setIsOpen(false);

      if (!isClickInAppArea) {
        selected();
      }
    };

    const handleScroll = (event: Event) => {
      if (tooltipRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);

      const mainContainer = document.querySelector(".flex.flex-col.h-screen");
      if (!mainContainer?.contains(event.target as Node)) {
        selected();
      }
    };

    // Use a timeout to allow the click event that opened the tooltip to finish
    const timeoutId = setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [setIsOpen, selected, buttonRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={tooltipRef}
      style={{
        position: "fixed",
        ...(tooltipPosition === "bottom"
          ? { top: position.y }
          : { bottom: window.innerHeight - position.y }),
        ...(position.isLeft || tooltipSide === "left"
          ? {
              right: position.isLeft
                ? `calc(100vw - ${position.x}px + 10px)`
                : "auto",
            }
          : { left: `${position.x}px` }),
        maxHeight: "80vh",
        zIndex: 9999,
        pointerEvents: "auto",
      }}
      className="bg-white dark:bg-[#040405] rounded-lg shadow-lg border border-gray-200 dark:border-[#2c2934] divide-y divide-gray-200 dark:divide-[#2c2934] min-w-[200px] overflow-y-auto"
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement<TooltipItemProps>(child)) {
          return React.cloneElement(child, {
            closeMenu: () => {
              setIsOpen(false);
            },
          });
        }
        return child;
      })}
    </div>
  );
};

export const TooltipItem: React.FC<TooltipItemProps> = ({
  icon: Icon,
  label,
  onClick,
  isNew,
  closeMenu,
}) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick();
      if (closeMenu) closeMenu();
    }}
    className="w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2c2934] flex items-center gap-3 transition-colors duration-150 cursor-pointer"
  >
    <Icon className="w-4 h-4 flex-shrink-0" />
    <span className="flex-1 text-left">{label}</span>
    {isNew && (
      <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
        New
      </span>
    )}
  </button>
);
