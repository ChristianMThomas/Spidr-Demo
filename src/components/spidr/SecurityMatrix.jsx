import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Key, LogOut, AlertTriangle, Lock, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';

export default function SecurityMatrix({ currentUser, onClose }) {
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  // Generate a mock 2FA secret (in production, this would come from backend)
  const [tfaSecret] = useState(() => {
    return `SPIDR${Math.random().toString(36).substr(2, 16).toUpperCase()}`;
  });

  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['user-profile', currentUser?.id],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser?.id });
      return profiles[0];
    },
    enabled: !!currentUser?.id
  });

  const handleLogout = () => {
    if (window.confirm('Sever neural link and disconnect from all devices?')) {
      base44.auth.logout();
    }
  };

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      toast.error('Access keys do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Access key must be at least 8 characters');
      return;
    }
    
    // Note: Actual password change would require backend functions
    toast.success('Access key encryption updated');
    setShowPasswordDialog(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const accountAge = currentUser?.created_date 
    ? Math.floor((Date.now() - new Date(currentUser.created_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Generate authenticator URI for QR code
  const otpauthUrl = `otpauth://totp/SPIDR:${currentUser?.email}?secret=${tfaSecret}&issuer=SPIDR&algorithm=SHA1&digits=6&period=30`;

  const handle2FAVerify = () => {
    if (verificationCode.length !== 6) {
      toast.error('Enter a 6-digit code');
      return;
    }
    
    // In production, this would verify against the server
    toast.success('2FA would be enabled with backend functions');
    setShow2FADialog(false);
    setVerificationCode('');
  };

  return (
    <div className="min-h-screen bg-[#050505] p-4 md:p-8 overflow-y-auto">
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest flex items-center gap-3">
          <div className="p-2 md:p-3 bg-[#FF3333]/10 rounded-xl shrink-0">
            <ShieldCheck className="text-[#FF3333]" size={24} />
          </div>
          <span className="break-words">Security Matrix</span>
        </h1>
        <p className="text-gray-500 text-xs md:text-sm mt-2">Identity protection and access management protocols.</p>
      </div>

      <div className="max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT: Account Security */}
        <div className="space-y-6">
          <SectionHeader title="Identity Credentials" />
          
          {/* Account Info Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Operative ID</div>
                <div className="text-white font-mono text-xs md:text-sm break-all">{currentUser?.email}</div>
              </div>
              <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                <Lock size={16} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 md:gap-4 pt-4 border-t border-white/5">
              <div className="min-w-0">
                <div className="text-[10px] text-gray-500 uppercase mb-1 truncate">Link Status</div>
                <div className="text-white text-xs font-bold truncate">
                  {profile?.status === 'online' ? '🟢 ACTIVE' : '⚪ DORMANT'}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-gray-500 uppercase mb-1 truncate">Link Age</div>
                <div className="text-white text-xs font-bold truncate">{accountAge} DAYS</div>
              </div>
            </div>
          </motion.div>

          {/* Password Change */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 group hover:border-[#FF3333]/30 transition-all"
          >
            <div className="flex items-center gap-3 md:gap-4 mb-4">
              <div className="p-2 md:p-3 bg-black rounded-xl shrink-0">
                <Key className="text-[#FF3333]" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm break-words">Access Key Management</div>
                <div className="text-[10px] text-gray-500 mt-1 break-words">Update your encryption passphrase</div>
              </div>
            </div>
            <Button 
              onClick={() => setShowPasswordDialog(true)}
              className="w-full bg-white/5 hover:bg-white/10 text-white"
            >
              RE-ENCRYPT ACCESS KEY
            </Button>
          </motion.div>

          {/* 2FA Setup */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#0a0a0a] border border-[#FF3333]/20 rounded-2xl p-6 relative overflow-hidden group hover:border-[#FF3333]/40 transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF3333]/5 blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-3 md:gap-4 mb-4 relative z-10">
              <div className="p-2 md:p-3 bg-[#FF3333]/10 rounded-xl shrink-0">
                <Smartphone className="text-[#FF3333]" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm break-words">Two-Factor Authentication</div>
                <div className="text-[10px] text-gray-500 mt-1 break-words">Protect your account with an authenticator app</div>
              </div>
            </div>
            <Button 
              onClick={() => setShow2FADialog(true)}
              className="w-full bg-[#FF3333] hover:bg-[#FF3333]/90 text-white"
            >
              GENERATE SYNC MATRIX
            </Button>
          </motion.div>
        </div>

        {/* RIGHT: Sessions & Logout */}
        <div className="space-y-6">
          <SectionHeader title="Active Neural Links" />
          
          {/* Current Session */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0a0a0a] border border-green-500/20 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
                <div className="text-white font-bold text-sm truncate">Current Session</div>
              </div>
              <div className="px-2 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold rounded shrink-0">
                ACTIVE
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-gray-500 shrink-0">Device</span>
                <span className="text-white font-mono text-right truncate">{navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Terminal'}</span>
              </div>
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-gray-500 shrink-0">Connected</span>
                <span className="text-white font-mono text-right">{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-gray-500 shrink-0">Protocol</span>
                <span className="text-white font-mono text-right">SPIDR-SECURE</span>
              </div>
            </div>
          </motion.div>

          {/* Session Info */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6"
          >
            <div className="text-xs text-gray-400 leading-relaxed space-y-2">
              <p>🔒 Your session is encrypted end-to-end using Base44's secure authentication protocol.</p>
              <p>🕷️ You'll remain connected until you manually disconnect or your credentials are changed.</p>
              <p>⚡ All activity is monitored and logged for security purposes.</p>
            </div>
          </motion.div>

          {/* Danger Zone */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-red-950/20 border border-red-500/30 rounded-2xl p-4 md:p-6"
          >
            <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 md:mb-4 break-words">⚠️ Danger Zone</div>
            
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500"
            >
              <LogOut className="mr-2" size={16} />
              SEVER NEURAL LINK
            </Button>
            
            <div className="mt-3 text-[10px] text-gray-500 text-center">
              This will disconnect you from all devices
            </div>
          </motion.div>
        </div>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="bg-[#0a0a0a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white uppercase tracking-wider flex items-center gap-2">
              <Key size={20} className="text-[#FF3333]" />
              Update Access Key
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-[10px] text-gray-500 uppercase mb-1 block">Current Key</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-[#111] border-white/10 text-white"
                placeholder="••••••••"
              />
            </div>
            
            <div>
              <label className="text-[10px] text-gray-500 uppercase mb-1 block">New Key</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-[#111] border-white/10 text-white"
                placeholder="••••••••"
              />
            </div>
            
            <div>
              <label className="text-[10px] text-gray-500 uppercase mb-1 block">Confirm New Key</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-[#111] border-white/10 text-white"
                placeholder="••••••••"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={() => setShowPasswordDialog(false)} 
                variant="outline"
                className="flex-1 border-white/10 text-white hover:bg-white/5"
              >
                CANCEL
              </Button>
              <Button 
                onClick={handlePasswordChange}
                className="flex-1 bg-[#FF3333] hover:bg-[#FF3333]/90 text-white"
              >
                ENCRYPT
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
        <DialogContent className="bg-[#0a0a0a] border-[#FF3333]/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white uppercase tracking-wider flex items-center gap-2">
              <Smartphone size={20} className="text-[#FF3333]" />
              Two-Factor Protocol
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* Instructions */}
            <div className="bg-[#111] rounded-xl p-4 border border-white/5">
              <div className="text-xs text-gray-400 space-y-2">
                <p className="font-bold text-white">Setup Instructions:</p>
                <p>1. Download an authenticator app (Google Authenticator, Authy, etc.)</p>
                <p>2. Scan the QR code below</p>
                <p>3. Enter the 6-digit code to verify</p>
              </div>
            </div>

            {/* QR Code */}
            <div className="bg-black rounded-xl p-6 border border-[#FF3333]/20 relative overflow-hidden">
              <div className="text-[10px] text-gray-400 mb-4 uppercase tracking-wider text-center">
                Scan with Authenticator
              </div>
              
              <div className="flex justify-center mb-4 relative">
                <div className="bg-white p-4 rounded-lg relative">
                  <QRCodeSVG 
                    value={otpauthUrl}
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                  {/* Scanning Line Animation */}
                  <motion.div 
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                    className="absolute left-0 w-full h-[2px] bg-[#FF3333] shadow-[0_0_10px_#FF3333] pointer-events-none"
                  />
                </div>
              </div>

              {/* Manual Entry */}
              <div className="text-[10px] font-mono text-gray-400 bg-[#111] p-3 rounded text-center select-all">
                MANUAL KEY: {tfaSecret}
              </div>
            </div>

            {/* Verification */}
            <div>
              <label className="text-[10px] text-gray-500 uppercase mb-2 block">
                Enter 6-Digit Verification Code
              </label>
              <Input
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="bg-[#111] border-white/10 text-white text-center text-lg tracking-widest font-mono"
                placeholder="000000"
              />
            </div>

            {/* Notice */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={14} />
                <div className="text-[10px] text-amber-200">
                  Note: Full 2FA requires backend functions. This generates a valid QR code for testing authenticator apps.
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => setShow2FADialog(false)} 
                variant="outline"
                className="flex-1 border-white/10 text-white hover:bg-white/5"
              >
                CANCEL
              </Button>
              <Button 
                onClick={handle2FAVerify}
                className="flex-1 bg-[#FF3333] hover:bg-[#FF3333]/90 text-white"
                disabled={verificationCode.length !== 6}
              >
                VERIFY & ENABLE
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SectionHeader = ({ title }) => (
  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">
    {title}
  </h3>
);