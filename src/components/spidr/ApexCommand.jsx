import React, { useState } from 'react';
import { CreditCard, Calendar, Download, AlertTriangle, Crown, ChevronRight, ShieldCheck, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ApexCommand({ isOpen, onClose, currentTier = 'free' }) {
  const [planType, setPlanType] = useState('monthly');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Mock subscription data (replace with real Stripe data)
  const subData = {
    status: currentTier === 'apex' ? 'active' : 'cancelled',
    nextBilling: 'Mar 14, 2026',
    amount: planType === 'monthly' ? 7.99 : 76.99,
    cardLast4: '4242',
    cardExpiry: '12/28',
    startDate: 'Dec 14, 2025',
    uploadedGB: 4.2,
    overclockUsed: 12
  };

  const handleCancelSubscription = () => {
    // Implement Stripe cancellation logic
    setShowCancelDialog(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] bg-[#050505] border-[#FF3333]/20 p-0 overflow-hidden">
        
        {/* HEADER BAR */}
        <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="text-white" size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Crown className="text-[#FF3333]" size={20} />
                APEX COMMAND
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                {subData.status === 'active' ? '🟢 Signal Strength: Maximum' : '⚪ Offline'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-500 hover:text-white"
          >
            <X size={20} />
          </Button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="overflow-y-auto h-full p-6">
          
          {/* BACKGROUND GLOW */}
          <div className="absolute top-20 right-0 w-96 h-96 bg-[#FF3333]/10 blur-[150px] pointer-events-none" />

          {/* GRID LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
            
            {/* LEFT: STATUS CARD */}
            <div className="lg:col-span-2 bg-[#111] rounded-2xl border border-white/10 p-1 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#FF3333]/20 via-purple-500/20 to-[#FF3333]/20 opacity-50 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative bg-[#0a0a0a] rounded-xl h-full p-6 md:p-8">
                {/* Background Animation */}
                <div className="absolute -right-20 -top-20 w-80 h-80 bg-gradient-to-br from-[#FF3333]/10 to-transparent rounded-full blur-3xl animate-pulse" />

                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="text-[#FF3333]" size={24} />
                      <span className="text-xl md:text-2xl font-bold text-white">
                        {currentTier === 'apex' ? 'APEX Tier 1' : 'Free Tier'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm max-w-sm">
                      {currentTier === 'apex' 
                        ? 'Squad Overclock active. Deep Storage accessible. Your neural link is operating at 100% efficiency.'
                        : 'Upgrade to APEX for premium features, unlimited storage, and exclusive customization options.'
                      }
                    </p>
                  </div>
                  
                  {/* Plan Switcher */}
                  {currentTier === 'apex' && (
                    <div className="bg-black/50 border border-white/10 p-1 rounded-lg flex text-xs font-bold shrink-0">
                      <button 
                        onClick={() => setPlanType('monthly')}
                        className={`px-3 py-1.5 rounded transition-all ${planType === 'monthly' ? 'bg-[#FF3333] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                      >
                        Monthly
                      </button>
                      <button 
                        onClick={() => setPlanType('yearly')}
                        className={`px-3 py-1.5 rounded transition-all ${planType === 'yearly' ? 'bg-[#FF3333] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                      >
                        Yearly (-20%)
                      </button>
                    </div>
                  )}
                </div>

                {/* Stats Row */}
                {currentTier === 'apex' && (
                  <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/5 pt-6 relative z-10">
                    <Stat label="Current Rate" value={`$${subData.amount}`} unit={planType === 'monthly' ? '/mo' : '/yr'} />
                    <Stat label="Storage Used" value={subData.uploadedGB.toString()} unit="GB" />
                    <Stat label="Overclocks" value={subData.overclockUsed.toString()} unit="Used" />
                  </div>
                )}

                {/* Next Billing */}
                {currentTier === 'apex' && (
                  <div className="mt-6 flex items-center justify-between text-sm border-t border-white/5 pt-4 relative z-10">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar size={14} />
                      Next Billing Cycle
                    </div>
                    <div className="font-mono text-white font-bold">{subData.nextBilling}</div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: PAYMENT METHOD */}
            <div className="bg-[#111] rounded-2xl border border-white/10 p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[80px] pointer-events-none" />

              <div className="relative z-10">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CreditCard size={14} /> Funding Source
                </h3>
                
                {currentTier === 'apex' ? (
                  <>
                    {/* Credit Card Display */}
                    <div className="bg-gradient-to-br from-gray-800 to-black border border-white/10 rounded-xl p-5 shadow-2xl relative overflow-hidden group hover:border-[#FF3333]/50 transition-colors">
                      <div className="absolute top-0 left-0 w-full h-[1px] bg-white/20" />
                      <div className="flex justify-between items-start mb-8">
                        <div className="w-10 h-6 bg-yellow-500/80 rounded flex items-center justify-center">
                          <div className="w-6 h-4 border border-black/20 rounded-sm grid grid-cols-2 gap-[1px]">
                            <div className="bg-black/10" /><div className="bg-black/10" />
                          </div>
                        </div>
                        <span className="font-mono text-white/50 text-xs">VISA</span>
                      </div>
                      <div className="font-mono text-lg text-white tracking-widest mb-2">•••• •••• •••• {subData.cardLast4}</div>
                      <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                        <span>EXP: {subData.cardExpiry}</span>
                        <span>CVC: •••</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowPaymentDialog(true)}
                      className="mt-4 w-full py-2.5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                    >
                      UPDATE PAYMENT
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-xs">No payment method on file</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* INVOICE HISTORY */}
          {currentTier === 'apex' && (
            <div className="mt-8">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Transaction Log</h3>
              
              <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <InvoiceRow date="Feb 14, 2026" id="INV-2026-003" amount="$7.99" status="Paid" />
                <InvoiceRow date="Jan 14, 2026" id="INV-2026-002" amount="$7.99" status="Paid" />
                <InvoiceRow date="Dec 14, 2025" id="INV-2025-012" amount="$7.99" status="Paid" />
              </div>
              
              <button className="mt-4 text-xs text-[#FF3333] font-bold hover:underline flex items-center gap-1">
                <Download size={12} /> DOWNLOAD FULL MANIFEST
              </button>
            </div>
          )}

          {/* DANGER ZONE */}
          {currentTier === 'apex' && (
            <div className="mt-8 p-6 rounded-2xl border border-red-500/20 bg-red-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-red-500 font-bold text-sm mb-1">
                  <AlertTriangle size={16} />
                  SEVER CONNECTION
                </div>
                <p className="text-xs text-gray-500 max-w-md">
                  Disconnecting will remove APEX privileges at the end of the billing cycle. 
                  Data in Deep Storage may be archived.
                </p>
              </div>
              <button 
                onClick={() => setShowCancelDialog(true)}
                className="px-5 py-2.5 bg-red-500/10 text-red-500 border border-red-500/50 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all shrink-0"
              >
                CANCEL SUBSCRIPTION
              </button>
            </div>
          )}
        </div>

        {/* CANCEL CONFIRMATION DIALOG */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="bg-[#0a0a0a] border-red-500/30 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} />
                Confirm Disconnection
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <p className="text-gray-400 text-sm">
                Are you sure you want to cancel your APEX subscription? You'll lose access to:
              </p>
              <ul className="text-xs text-gray-500 space-y-2 ml-4">
                <li>• Squad Overclock (4K/60FPS boost)</li>
                <li>• Deep Storage (unlimited uploads)</li>
                <li>• Custom Thread Skins</li>
                <li>• Entry Protocols & Aura Display</li>
              </ul>
              <p className="text-xs text-amber-400 bg-amber-500/10 p-3 rounded-lg">
                Your subscription will remain active until {subData.nextBilling}
              </p>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => setShowCancelDialog(false)}
                  variant="outline"
                  className="flex-1 border-white/10 text-white hover:bg-white/5"
                >
                  KEEP APEX
                </Button>
                <Button 
                  onClick={handleCancelSubscription}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  CONFIRM CANCEL
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* UPDATE PAYMENT DIALOG */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="text-[#FF3333]" size={20} />
                Update Payment Method
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <p className="text-gray-400 text-sm">
                This will open your Stripe billing portal to securely update your payment information.
              </p>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => setShowPaymentDialog(false)}
                  variant="outline"
                  className="flex-1 border-white/10 text-white hover:bg-white/5"
                >
                  CANCEL
                </Button>
                <Button 
                  onClick={() => {
                    // Open Stripe billing portal
                    window.open('https://billing.stripe.com/session/...' , '_blank');
                    setShowPaymentDialog(false);
                  }}
                  className="flex-1 bg-[#FF3333] hover:bg-[#FF3333]/90 text-white"
                >
                  OPEN PORTAL
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </DialogContent>
    </Dialog>
  );
}

// SUB-COMPONENTS
function Stat({ label, value, unit }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">{label}</div>
      <div className="text-xl font-mono text-white">
        {value} <span className="text-xs text-gray-600 font-sans">{unit}</span>
      </div>
    </div>
  );
}

function InvoiceRow({ date, id, amount, status }) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors group">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-black rounded-lg text-[#FF3333] group-hover:text-white transition-colors">
          <ShieldCheck size={16} />
        </div>
        <div>
          <div className="text-sm font-bold text-white">{date}</div>
          <div className="text-[10px] text-gray-500 font-mono">{id}</div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 md:gap-6">
        <div className="text-right">
          <div className="text-sm font-bold text-white">{amount}</div>
          <div className="text-[10px] text-green-500 uppercase font-bold">{status}</div>
        </div>
        <button className="p-2 text-gray-600 hover:text-white transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}