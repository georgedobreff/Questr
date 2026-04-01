'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import {
    Wallet,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2
} from 'lucide-react';
import { requestWithdrawal } from '@/app/actions/revenue-actions';
import { toast } from 'sonner';

interface RevenueDashboardProps {
    balanceCents: number;
    ledger: any[];
    withdrawals: any[];
}

export function RevenueDashboard({ balanceCents, ledger, withdrawals }: RevenueDashboardProps) {
    const [isPending, startTransition] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');

    const formatCurrency = (cents: number) => {
        return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const handleWithdraw = () => {
        const amountCents = Math.floor(parseFloat(withdrawAmount) * 100);

        if (isNaN(amountCents) || amountCents <= 0) {
            toast.error('Please enter a valid amount.');
            return;
        }

        if (amountCents > balanceCents) {
            toast.error('Insufficient funds.');
            return;
        }

        startTransition(async () => {
            const result = await requestWithdrawal(amountCents);
            if (result.success) {
                toast.success('Withdrawal request submitted successfully!');
                setIsDialogOpen(false);
                setWithdrawAmount('');
            } else {
                toast.error(result.error || 'Failed to submit withdrawal request.');
            }
        });
    };

    const getRelativeTime = (date: Date) => {
        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
        const daysDifference = Math.round((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysDifference === 0) return 'today';
        return rtf.format(daysDifference, 'day');
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
            case 'paid': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'rejected': return <XCircle className="w-4 h-4 text-destructive" />;
            default: return <Clock className="w-4 h-4 text-amber-500" />;
        }
    };

    return (
        <div className="space-y-8">
            {/* Header & Balance Card */}
            <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 shadow-sm overflow-hidden p-8 md:pl-28 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1 space-y-6 md:pl-8">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-primary" />
                                Available Balance
                            </CardTitle>
                            <CardDescription>Funds available for withdrawal</CardDescription>
                        </div>
                        
                        <div className="text-4xl md:text-6xl font-bold text-primary" style={{ fontFamily: 'var(--font-uncial-antiqua)' }}>
                            {formatCurrency(balanceCents)}
                        </div>
                        
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button 
                                    size="lg" 
                                    className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400 to-amber-600 border-amber-500 shadow-md hover:brightness-110"
                                    disabled={balanceCents <= 0}
                                >
                                    Request Withdrawal
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Request Withdrawal</DialogTitle>
                                    <DialogDescription>
                                        Enter the amount you wish to withdraw to your bank account.
                                        Staff will review and process your request within 3-5 business days.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Amount (USD)</Label>
                                        <Input 
                                            type="number" 
                                            placeholder="0.00" 
                                            min="0.01"
                                            step="0.01"
                                            max={(balanceCents / 100).toString()}
                                            value={withdrawAmount}
                                            onChange={(e) => setWithdrawAmount(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Max available: {formatCurrency(balanceCents)}
                                        </p>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isPending}>Cancel</Button>
                                    <Button onClick={handleWithdraw} disabled={isPending || !withdrawAmount}>
                                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                        Submit Request
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                    
                    <div className="opacity-10 pointer-events-none shrink-0 order-first md:order-last mb-4 md:mb-0">
                        <Wallet className="w-24 h-24 md:w-40 md:h-40" />
                    </div>
                </Card>

                {/* Quick Stats or Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Revenue Sharing</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                        <p>
                            As a Guild Master, you receive <strong>10%</strong> of the subscription value for any member of your guild that is subscribed to Pro.
                        </p>
                        <p>
                            Revenue is automatically allocated to your ledger when a member's invoice is successfully paid.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Ledger History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowDownRight className="w-5 h-5 text-emerald-500" />
                            Revenue History
                        </CardTitle>
                        <CardDescription>Recent allocations from your guild members</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {ledger.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No revenue history yet.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {ledger.map((item) => (
                                    <div key={item.id} className="flex justify-between items-center p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                                        <div className="space-y-1">
                                            <p className="font-medium text-sm leading-none flex items-center gap-2">
                                                <span className="text-emerald-500 font-semibold">+{formatCurrency(item.amount_cents)}</span>
                                                <span className="text-muted-foreground/50 text-xs">|</span>
                                                <span>{item.source_user?.full_name || 'Unknown Member'}</span>
                                            </p>
                                            <p className="text-xs text-muted-foreground">{item.description}</p>
                                        </div>
                                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                                            {getRelativeTime(new Date(item.created_at))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Withdrawal History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowUpRight className="w-5 h-5 text-amber-500" />
                            Withdrawal Requests
                        </CardTitle>
                        <CardDescription>Status of your payout requests</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {withdrawals.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No withdrawal requests yet.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {withdrawals.map((req) => (
                                    <div key={req.id} className="flex justify-between items-center p-3 rounded-lg border bg-card">
                                        <div className="space-y-1">
                                            <p className="font-medium text-sm leading-none">
                                                {formatCurrency(req.amount_cents)}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1 text-xs">
                                                {getStatusIcon(req.status)}
                                                <span className="capitalize text-muted-foreground">{req.status}</span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                                            {getRelativeTime(new Date(req.created_at))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
