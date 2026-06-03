import React, { useState } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import ResultsList from '@/components/shared/ResultsList';
import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatFileSize } from '@/lib/imageUtils';
import { encryptPdf } from '@/lib/pdfCore';

export default function PdfSecurity() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('add');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [permissions, setPermissions] = useState({
    allowPrinting: true,
    disableEditing: false,
    disableCopying: false,
    disableAnnotating: false,
  });
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const handleFiles = (files) => {
    const f = files[0];
    if (f?.name.toLowerCase().endsWith('.pdf')) { setFile(f); setResults([]); setError(''); }
  };

  const apply = async () => {
    setError('');
    if (!password) return setError('Please enter a password');
    if (mode === 'add' && password !== confirmPassword) return setError('Passwords do not match');

    setStatus('processing');
    setProgress(30);

    const blob = await encryptPdf(file, mode === 'add' ? password : '', mode === 'add' ? password : '', permissions);
    setProgress(100);
    setResults([{ blob, name: file.name.replace('.pdf', mode === 'add' ? '_protected.pdf' : '_unlocked.pdf'), size: blob.size }]);
    setStatus('done');
  };

  const setPerm = (key, val) => setPermissions(p => ({ ...p, [key]: val }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="PDF Security" description="Add or remove password protection and permissions" icon={Lock} />

        {!file ? (
          <FileDropzone accept=".pdf" onFiles={handleFiles} label="Drop a PDF to secure" />
        ) : (
          <div className="space-y-6">
            <div className="p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3">
              <Lock className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setResults([]); }}>Change</Button>
            </div>

            <Tabs value={mode} onValueChange={v => { setMode(v); setError(''); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="add">Add Password</TabsTrigger>
                <TabsTrigger value="remove">Remove Password</TabsTrigger>
              </TabsList>

              <TabsContent value="add" className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password</Label>
                    <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
                  <h4 className="text-sm font-semibold">Permissions</h4>
                  {[
                    { key: 'allowPrinting', label: 'Allow Printing' },
                    { key: 'disableEditing', label: 'Disable Editing' },
                    { key: 'disableCopying', label: 'Disable Copying' },
                    { key: 'disableAnnotating', label: 'Disable Annotations' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-sm">{label}</Label>
                      <Switch checked={permissions[key]} onCheckedChange={v => setPerm(key, v)} />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="remove" className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter current password to remove" />
                </div>
              </TabsContent>
            </Tabs>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <ProgressBar progress={progress} status={status} />

            <Button onClick={apply} disabled={status === 'processing'} className="w-full h-12 text-base rounded-xl">
              <Lock className="w-5 h-5 mr-2" />
              {mode === 'add' ? 'Protect PDF' : 'Remove Password'}
            </Button>

            <ResultsList results={results} title="Secured PDF" />
          </div>
        )}
      </main>
    </div>
  );
}