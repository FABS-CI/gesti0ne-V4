import { useEffect, useRef, useCallback, useState } from "react";
import { signOutAndRedirect } from "@/lib/auth/logout";

const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE = 2 * 60 * 1000; // alerte 2 min avant

export function useIdleTimeout() {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(120);
  const warningRef = useRef(false);
  useEffect(() => {
    warningRef.current = showWarning;
  }, [showWarning]);

  const handleLogout = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearTimeout(warningTimer.current);
    clearInterval(countdownInterval.current);
    setShowWarning(false);
    signOutAndRedirect("idle_timeout");
  }, []);

  const resetTimers = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearTimeout(warningTimer.current);
    clearInterval(countdownInterval.current);
    setShowWarning(false);
    setCountdown(120);

    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      let remaining = 120;
      setCountdown(remaining);
      countdownInterval.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) clearInterval(countdownInterval.current);
      }, 1000);
    }, IDLE_TIMEOUT - WARNING_BEFORE);

    idleTimer.current = setTimeout(() => {
      handleLogout();
    }, IDLE_TIMEOUT);
  }, [handleLogout]);

  const extendSession = useCallback(() => {
    setShowWarning(false);
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    const onActivity = () => {
      // Ne pas réinitialiser tant que l'avertissement est affiché (sauf via "Rester connecté")
      if (!warningRef.current) resetTimers();
    };
    events.forEach((e) => document.addEventListener(e, onActivity, { passive: true }));
    resetTimers();
    return () => {
      events.forEach((e) => document.removeEventListener(e, onActivity));
      clearTimeout(idleTimer.current);
      clearTimeout(warningTimer.current);
      clearInterval(countdownInterval.current);
    };
  }, [resetTimers]);

  return { showWarning, countdown, extendSession, handleLogout };
}
