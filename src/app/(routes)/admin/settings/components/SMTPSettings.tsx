'use client';

import { useState, useEffect } from 'react';
import { Mail, Server, Lock, User, Check, Eye, EyeOff, AlertCircle, Zap, CheckCircle, XCircle } from 'lucide-react';
import { SettingsData } from '../services/settingsService';

interface SMTPSettingsProps {
  settings: SettingsData;
  onUpdate: (data: Partial<SettingsData>) => Promise<void>;
  isLoading: boolean;
}

interface SMTPData {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  smtpFromEmail: string;
  smtpFromName: string;
  smtpSecure: boolean;
}

export default function SMTPSettings({ settings, onUpdate, isLoading }: SMTPSettingsProps) {
  const [smtpData, setSmtpData] = useState<SMTPData>({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    smtpFromEmail: '',
    smtpFromName: '',
    smtpSecure: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setSmtpData({
        smtpHost: settings.smtpHost || '',
        smtpPort: settings.smtpPort || '587',
        smtpUser: settings.smtpUser || '',
        smtpPassword: settings.smtpPassword || '',
        smtpFromEmail: settings.smtpFromEmail || '',
        smtpFromName: settings.smtpFromName || '',
        smtpSecure: settings.smtpSecure ?? true,
      });
    }
  }, [settings]);

  const handleInputChange = (field: keyof SMTPData, value: string | boolean) => {
    setSmtpData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await onUpdate(smtpData);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving SMTP settings:', error);
    }
  };

  const handleReset = () => {
    setSmtpData({
      smtpHost: settings.smtpHost || '',
      smtpPort: settings.smtpPort || '587',
      smtpUser: settings.smtpUser || '',
      smtpPassword: settings.smtpPassword || '',
      smtpFromEmail: settings.smtpFromEmail || '',
      smtpFromName: settings.smtpFromName || '',
      smtpSecure: settings.smtpSecure ?? true,
    });
    setHasChanges(false);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!smtpData.smtpHost || !smtpData.smtpUser || !smtpData.smtpPassword) {
      setTestResult({ success: false, message: 'Please fill in host, username and password first' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/settings/test-smtp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          host: smtpData.smtpHost,
          port: smtpData.smtpPort,
          user: smtpData.smtpUser,
          password: smtpData.smtpPassword,
          secure: smtpData.smtpSecure,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTestResult({ success: true, message: data.message || 'Connection successful! SMTP is configured correctly.' });
      } else {
        setTestResult({ success: false, message: data.message || 'Connection failed. Please check your SMTP settings.' });
      }
    } catch (error) {
      console.error('Error testing SMTP connection:', error);
      setTestResult({ success: false, message: 'Failed to test connection. Please try again.' });
    } finally {
      setIsTesting(false);
    }
  };

  const isConfigured = smtpData.smtpHost && smtpData.smtpUser && smtpData.smtpPassword;

  return (
    <div className="space-y-5 sm:space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">SMTP Configuration</h3>
        </div>
        <p className="text-xs sm:text-sm text-gray-500">
          Configure email server settings for sending transactional emails
        </p>
      </div>

      {/* Status Banner */}
      <div className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-md sm:rounded-lg ${isConfigured ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
        {isConfigured ? (
          <>
            <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">SMTP Configured</p>
              <p className="text-xs text-green-600">Your email server is set up and ready</p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">SMTP Not Configured</p>
              <p className="text-xs text-amber-600">Configure your email server to send emails</p>
            </div>
          </>
        )}
      </div>

      {/* SMTP Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
        {/* SMTP Host */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Server className="h-4 w-4 text-gray-500" />
            SMTP Host
          </label>
          <input
            type="text"
            placeholder="smtp.example.com"
            value={smtpData.smtpHost}
            onChange={(e) => handleInputChange('smtpHost', e.target.value)}
            className="w-full px-4 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
          />
        </div>

        {/* SMTP Port */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Server className="h-4 w-4 text-gray-500" />
            SMTP Port
          </label>
          <input
            type="text"
            placeholder="587"
            value={smtpData.smtpPort}
            onChange={(e) => handleInputChange('smtpPort', e.target.value)}
            className="w-full px-4 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
          />
        </div>

        {/* SMTP Username */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <User className="h-4 w-4 text-gray-500" />
            Username
          </label>
          <input
            type="text"
            placeholder="your-email@example.com"
            value={smtpData.smtpUser}
            onChange={(e) => handleInputChange('smtpUser', e.target.value)}
            className="w-full px-4 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
          />
        </div>

        {/* SMTP Password */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Lock className="h-4 w-4 text-gray-500" />
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={smtpData.smtpPassword}
              onChange={(e) => handleInputChange('smtpPassword', e.target.value)}
              className="w-full px-4 py-2.5 pr-12 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
          </div>
        </div>

        {/* From Email */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Mail className="h-4 w-4 text-gray-500" />
            From Email
          </label>
          <input
            type="email"
            placeholder="noreply@example.com"
            value={smtpData.smtpFromEmail}
            onChange={(e) => handleInputChange('smtpFromEmail', e.target.value)}
            className="w-full px-4 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
          />
        </div>

        {/* From Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <User className="h-4 w-4 text-gray-500" />
            From Name
          </label>
          <input
            type="text"
            placeholder="Your Store Name"
            value={smtpData.smtpFromName}
            onChange={(e) => handleInputChange('smtpFromName', e.target.value)}
            className="w-full px-4 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* SSL/TLS Toggle */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-md sm:rounded-lg">
        <div>
          <p className="text-sm font-medium text-gray-900">Use SSL/TLS</p>
          <p className="text-xs text-gray-500">Enable secure connection (recommended)</p>
        </div>
        <button
          type="button"
          onClick={() => handleInputChange('smtpSecure', !smtpData.smtpSecure)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            smtpData.smtpSecure ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              smtpData.smtpSecure ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Test Connection */}
      <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Test Connection</h4>
            <p className="text-xs text-gray-500">Verify your SMTP server is working</p>
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !isConfigured}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isTesting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Test Connection
              </>
            )}
          </button>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`flex items-center gap-2 p-2 sm:p-3 rounded-md sm:rounded-lg ${testResult.success ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'}`}>
            {testResult.success ? (
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0" />
            )}
            <p className={`text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {testResult.message}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {hasChanges && (
        <div className="flex items-center justify-between pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-honey-500 rounded-lg hover:bg-honey-600 focus:ring-2 focus:ring-offset-2 focus:ring-honey-500 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
