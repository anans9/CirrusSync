import React, { useState, useEffect, useCallback } from 'react';
import { Share2, Upload, Download, FileText, Lock, Shield } from 'lucide-react';

const ComingSoonPage = () => {
  // Use a single state object instead of separate states
  const [countdown, setCountdown] = useState({
    days: 14,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Use useCallback to memoize the update function
  const updateCountdown = useCallback(() => {
    const now = new Date();
    // Set launch date to be 14 days from when the component first mounts
    const launchDate = new Date(now);
    launchDate.setDate(launchDate.getDate() + 14); // Use fixed value instead of state
    
    const difference = launchDate.getTime() - now.getTime();
    
    if (difference <= 0) {
      return false;
    }
    
    const d = Math.floor(difference / (1000 * 60 * 60 * 24));
    const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((difference % (1000 * 60)) / 1000);
    
    // Update all values at once to prevent multiple re-renders
    setCountdown({ days: d, hours: h, minutes: m, seconds: s });
    return true;
  }, []);

  useEffect(() => {
    // Run once immediately
    updateCountdown();
    
    // Then set up the interval
    const interval = setInterval(() => {
      const shouldContinue = updateCountdown();
      if (!shouldContinue) {
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []); // Remove the dependency on days

  const { days, hours, minutes, seconds } = countdown;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#0e0d12] items-center justify-center p-4">
      <div className="max-w-4xl w-full backdrop-filter backdrop-blur-sm rounded-xl overflow-hidden border border-emerald-100 dark:border-emerald-900 shadow-xl">
        <div className="flex flex-col lg:flex-row">
          {/* Left content section */}
          <div className="w-full lg:w-1/2 p-6 sm:p-8 flex flex-col justify-center dark:bg-[#13121a]">
            <div className="inline-flex items-center rounded-full px-3 py-1 mb-6 bg-emerald-500 bg-opacity-10 text-emerald-500 dark:text-emerald-400 text-sm font-medium">
              <Lock className="w-4 h-4 mr-2" />
              <span>Coming Soon</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-white mb-4">File Sharing</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              Securely share files with end-to-end encryption.
            </p>
            
            {/* Countdown timer - now with fixed sizing to prevent layout shifts */}
            <div className="grid grid-cols-4 gap-3 mb-8">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 flex items-center justify-center rounded-lg dark:bg-[#1c1b24] border border-emerald-100 dark:border-emerald-900 mb-2">
                  <span className="text-emerald-500 dark:text-emerald-400 text-xl font-bold">{days}</span>
                </div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Days</span>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 flex items-center justify-center rounded-lg dark:bg-[#1c1b24] border border-emerald-100 dark:border-emerald-900 mb-2">
                  <span className="text-emerald-500 dark:text-emerald-400 text-xl font-bold">{hours}</span>
                </div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Hours</span>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 flex items-center justify-center rounded-lg dark:bg-[#1c1b24] border border-emerald-100 dark:border-emerald-900 mb-2">
                  <span className="text-emerald-500 dark:text-emerald-400 text-xl font-bold">{minutes}</span>
                </div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Mins</span>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 flex items-center justify-center rounded-lg dark:bg-[#1c1b24] border border-emerald-100 dark:border-emerald-900 mb-2">
                  <span className="text-emerald-500 dark:text-emerald-400 text-xl font-bold">{seconds}</span>
                </div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Secs</span>
              </div>
            </div>
            
            {/* Security features */}
            <div className="space-y-3">
              <div className="flex items-center">
                <div className="w-8 h-8 flex items-center justify-center rounded-full dark:bg-[#1c1b24] mr-3">
                  <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-800 dark:text-white">End-to-End Encryption</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Your files remain private and secure</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="w-8 h-8 flex items-center justify-center rounded-full dark:bg-[#1c1b24] mr-3">
                  <Upload className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-800 dark:text-white">Easy File Sharing</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Share with anyone, anywhere</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right visual section */}
          <div className="w-full lg:w-1/2 dark:bg-[#18171f] p-6 sm:p-8 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 rounded-full bg-emerald-500 filter blur-3xl"></div>
              <div className="absolute bottom-1/4 right-1/4 w-1/2 h-1/2 rounded-full bg-teal-500 filter blur-3xl"></div>
            </div>
            
            <div className="relative">
              <div className="relative w-64 h-64 flex items-center justify-center">
                <div className="absolute inset-0 dark:bg-[#1e1d25] rounded-2xl flex items-center justify-center border border-emerald-800 dark:border-opacity-40 shadow-lg">
                  <Share2 className="w-24 h-24 text-emerald-500 dark:text-emerald-400" />
                </div>
                
                <div className="absolute -top-6 -right-6 w-16 h-16 dark:bg-[#1c1b24] rounded-lg flex items-center justify-center border border-emerald-800 dark:border-opacity-30">
                  <Upload className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                </div>
                
                <div className="absolute -bottom-6 -left-6 w-20 h-20 dark:bg-[#1c1b24] rounded-lg flex items-center justify-center border border-emerald-800 dark:border-opacity-30">
                  <Download className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
                </div>
                
                <div className="absolute bottom-1/4 -right-10 w-14 h-14 dark:bg-[#1c1b24] rounded-lg flex items-center justify-center border border-emerald-800 dark:border-opacity-30">
                  <FileText className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                </div>
              </div>
              
              <div className="mt-8 text-center">
                <p className="text-sm text-gray-600 dark:text-emerald-400">Securely Share. Privately Connect.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonPage;