"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  FileCheck2,
  Play,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { queryKeys, useOperationsSnapshot, useSubscriptions } from "@/lib/api/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { loadMockData, saveMockData, createId } from "@/lib/mock/store";
import { USE_MOCKS } from "@/lib/api";
import type {
  BillingRun,
  Customer,
  Discount,
  Invoice,
  Payment,
  Quote,
  OperationsSnapshot,
} from "@/types/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type OperationsMode =
  | "customers"
  | "quotes"
  | "invoices"
  | "payments"
  | "billing"
  | "discounts"
  | "reports"
  | "portal";

const headings: Record<OperationsMode, { title: string; description: string }> = {
  customers: { title: "Customers", description: "Keep customer accounts, subscriptions, and balances in one operational view." },
  quotes: { title: "Quotations", description: "Turn reusable quotation templates into accepted subscription opportunities." },
  invoices: { title: "Invoices", description: "Review generated invoices, confirm them, and follow every outstanding balance." },
  payments: { title: "Payments", description: "Record incoming money and match it back to the invoice it settles." },
  billing: { title: "Billing runs", description: "Preview and run recurring billing without duplicate invoices or skipped periods." },
  discounts: { title: "Discounts", description: "Create controlled pricing rules with eligibility windows and redemption limits." },
  reports: { title: "Finance dashboard", description: "Answer the month-end questions with live recurring revenue and ageing summaries." },
  portal: { title: "Customer portal", description: "A focused self-service view for subscriptions, quotations, invoices, and payments." },
};

export function OperationsView({ mode }: { mode: OperationsMode }) {
  const { user, isAdmin, isStaff } = useAuth();
  const snapshotQuery = useOperationsSnapshot();
  const subscriptionsQuery = useSubscriptions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const heading = headings[mode];
  const snapshot = snapshotQuery.data;

  if (snapshotQuery.isLoading) {
    return <OperationsSkeleton title={heading.title} />;
  }

  if (snapshotQuery.isError || !snapshot) {
    return (
      <div className="space-y-6">
        <PageHeader title={heading.title} description={heading.description} />
        <ErrorState title={`${heading.title} could not be loaded`} onRetry={() => void snapshotQuery.refetch()} />
      </div>
    );
  }

  if (mode === "reports") return <ReportsView snapshot={snapshot} />;
  if (mode === "portal") {
    return (
      <PortalView
        snapshot={snapshot}
        subscriptions={subscriptionsQuery.data ?? []}
        userEmail={user?.email}
      />
    );
  }

  const query = search.trim().toLowerCase();

  if (mode === "customers") {
    const rows = snapshot.customers.filter((customer) => {
      const matchesQuery = !query || `${customer.name} ${customer.email} ${customer.legalName ?? ""}`.toLowerCase().includes(query);
      return matchesQuery && (status === "ALL" || customer.status === status);
    });
    const columns: DataColumn<Customer>[] = [
      { id: "customer", header: "Customer", cell: (customer) => <div><p className="font-medium">{customer.name}</p><p className="text-xs text-muted-foreground">{customer.email}</p></div> },
      { id: "status", header: "Status", cell: (customer) => <StatusBadge status={customer.status} /> },
      { id: "subscriptions", header: "Active subscriptions", cell: (customer) => <span className="tabular-nums">{customer.activeSubscriptions}</span> },
      { id: "outstanding", header: "Outstanding", cell: (customer) => <span className="font-medium tabular-nums">{formatCurrency(customer.outstandingAmount, "USD")}</span> },
      { id: "created", header: "Customer since", cell: (customer) => <span className="text-muted-foreground">{formatDate(customer.createdAt)}</span>, className: "hidden md:table-cell", headerClassName: "hidden md:table-cell" },
    ];
    return <OperationsTable mode="customers" snapshot={snapshot} heading={heading} search={search} setSearch={setSearch} status={status} setStatus={setStatus} statusOptions={["ACTIVE", "INACTIVE", "PROSPECT"]} count={`${rows.length} of ${snapshot.customers.length}`} data={rows} columns={columns} keyOf={(row) => row.id} icon={Users} emptyTitle="No customers found" actionLabel="Add customer" admin={isAdmin || isStaff} />;
  }

  if (mode === "quotes") {
    const rows = snapshot.quotes.filter((quote) => {
      const matchesQuery = !query || `${quote.number} ${quote.customerName} ${quote.templateName ?? ""}`.toLowerCase().includes(query);
      return matchesQuery && (status === "ALL" || quote.status === status);
    });
    const columns: DataColumn<Quote>[] = [
      { id: "number", header: "Quotation", cell: (quote) => <div><p className="font-medium">{quote.number}</p><p className="text-xs text-muted-foreground">{quote.templateName}</p></div> },
      { id: "customer", header: "Customer", cell: (quote) => <span>{quote.customerName}</span> },
      { id: "status", header: "Stage", cell: (quote) => <StatusBadge status={quote.status} /> },
      { id: "valid", header: "Valid until", cell: (quote) => <span className="text-muted-foreground">{formatDate(quote.validUntil)}</span> },
      { id: "total", header: "Total", cell: (quote) => <span className="font-medium tabular-nums">{formatCurrency(quote.total, "USD")}</span> },
    ];
    return <OperationsTable mode="quotes" snapshot={snapshot} heading={heading} search={search} setSearch={setSearch} status={status} setStatus={setStatus} statusOptions={["DRAFT", "QUOTATION", "ACCEPTED", "EXPIRED", "CANCELED"]} count={`${rows.length} of ${snapshot.quotes.length}`} data={rows} columns={columns} keyOf={(row) => row.id} icon={FileCheck2} emptyTitle="No quotations found" actionLabel="New quotation" admin={isAdmin || isStaff} />;
  }

  if (mode === "invoices") {
    const rows = snapshot.invoices.filter((invoice) => {
      const matchesQuery = !query || `${invoice.number} ${invoice.customerName}`.toLowerCase().includes(query);
      return matchesQuery && (status === "ALL" || invoice.status === status);
    });
    const columns: DataColumn<Invoice>[] = [
      { id: "number", header: "Invoice", cell: (invoice) => <div><p className="font-medium">{invoice.number}</p><p className="text-xs text-muted-foreground">Issued {formatDate(invoice.issueDate)}</p></div> },
      { id: "customer", header: "Customer", cell: (invoice) => <span>{invoice.customerName}</span> },
      { id: "status", header: "Status", cell: (invoice) => <StatusBadge status={invoice.status} /> },
      { id: "due", header: "Due", cell: (invoice) => <span className="text-muted-foreground">{formatDate(invoice.dueDate)}</span>, className: "hidden md:table-cell", headerClassName: "hidden md:table-cell" },
      { id: "total", header: "Balance", cell: (invoice) => <div><p className="font-medium tabular-nums">{formatCurrency(invoice.total - invoice.paidAmount, "USD")}</p><p className="text-xs text-muted-foreground">of {formatCurrency(invoice.total, "USD")}</p></div> },
    ];
    return <OperationsTable mode="invoices" snapshot={snapshot} heading={heading} search={search} setSearch={setSearch} status={status} setStatus={setStatus} statusOptions={["DRAFT", "CONFIRMED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELED"]} count={`${rows.length} of ${snapshot.invoices.length}`} data={rows} columns={columns} keyOf={(row) => row.id} icon={ReceiptText} emptyTitle="No invoices found" actionLabel="Create invoice" admin={isAdmin || isStaff} />;
  }

  if (mode === "payments") {
    const rows = snapshot.payments.filter((payment) => !query || `${payment.number} ${payment.invoiceNumber} ${payment.customerName}`.toLowerCase().includes(query));
    const columns: DataColumn<Payment>[] = [
      { id: "number", header: "Payment", cell: (payment) => <div><p className="font-medium">{payment.number}</p><p className="text-xs text-muted-foreground">{payment.customerName}</p></div> },
      { id: "invoice", header: "Invoice", cell: (payment) => <span className="text-muted-foreground">{payment.invoiceNumber}</span> },
      { id: "method", header: "Method", cell: (payment) => <Badge variant="secondary">{payment.method.replace("_", " ")}</Badge> },
      { id: "date", header: "Date", cell: (payment) => <span className="text-muted-foreground">{formatDate(payment.paymentDate)}</span> },
      { id: "amount", header: "Amount", cell: (payment) => <span className="font-medium tabular-nums">{formatCurrency(payment.amount, "USD")}</span> },
    ];
    return <OperationsTable mode="payments" snapshot={snapshot} heading={heading} search={search} setSearch={setSearch} status="ALL" setStatus={setStatus} statusOptions={[]} count={`${rows.length} of ${snapshot.payments.length}`} data={rows} columns={columns} keyOf={(row) => row.id} icon={WalletCards} emptyTitle="No payments recorded" actionLabel="Record payment" admin={isAdmin || isStaff} />;
  }

  if (mode === "discounts") {
    const rows = snapshot.discounts.filter((discount) => !query || `${discount.name} ${discount.code}`.toLowerCase().includes(query));
    const columns: DataColumn<Discount>[] = [
      { id: "discount", header: "Rule", cell: (discount) => <div><p className="font-medium">{discount.name}</p><p className="font-mono text-xs text-muted-foreground">{discount.code}</p></div> },
      { id: "value", header: "Value", cell: (discount) => <span className="font-medium">{discount.type === "PERCENTAGE" ? `${discount.value}%` : formatCurrency(discount.value, "USD")}</span> },
      { id: "eligibility", header: "Eligibility", cell: (discount) => <span className="text-xs text-muted-foreground">Min {formatCurrency(discount.minimumPurchase, "USD")} · {discount.minimumQuantity}+ units</span> },
      { id: "usage", header: "Usage", cell: (discount) => <span className="tabular-nums">{discount.usedRedemptions}{discount.maxRedemptions ? ` / ${discount.maxRedemptions}` : ""}</span> },
      { id: "status", header: "Status", cell: (discount) => <StatusBadge status={discount.status} /> },
    ];
    return <OperationsTable mode="discounts" snapshot={snapshot} heading={heading} search={search} setSearch={setSearch} status="ALL" setStatus={setStatus} statusOptions={[]} count={`${rows.length} of ${snapshot.discounts.length}`} data={rows} columns={columns} keyOf={(row) => row.id} icon={Sparkles} emptyTitle="No discount rules" actionLabel="Create discount" admin={isAdmin} />;
  }

  const rows = snapshot.billingRuns.filter((run) => !query || `${run.number} ${run.status}`.toLowerCase().includes(query));
  const columns: DataColumn<BillingRun>[] = [
    { id: "number", header: "Billing run", cell: (run) => <div><p className="font-medium">{run.number}</p><p className="text-xs text-muted-foreground">{formatDate(run.billingDate)}</p></div> },
    { id: "status", header: "Status", cell: (run) => <StatusBadge status={run.status} /> },
    { id: "subscriptions", header: "Subscriptions", cell: (run) => <span className="tabular-nums">{run.subscriptions}</span> },
    { id: "invoices", header: "Invoices", cell: (run) => <span className="tabular-nums">{run.invoicesCreated}</span> },
    { id: "revenue", header: "Revenue", cell: (run) => <span className="font-medium tabular-nums">{formatCurrency(run.revenue, "USD")}</span> },
  ];
  return <BillingView heading={heading} search={search} setSearch={setSearch} rows={rows} columns={columns} isAdmin={isAdmin || isStaff} />;
}

function OperationsTable<T>({ mode, snapshot, heading, search, setSearch, status, setStatus, statusOptions, count, data, columns, keyOf, icon, emptyTitle, actionLabel, admin }: { mode: Exclude<OperationsMode, "billing" | "reports" | "portal">; snapshot: OperationsSnapshot; heading: { title: string; description: string }; search: string; setSearch: (value: string) => void; status: string; setStatus: (value: string) => void; statusOptions: string[]; count: string; data: T[]; columns: DataColumn<T>[]; keyOf: (row: T) => string; icon: typeof Users; emptyTitle: string; actionLabel: string; admin: boolean }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const createRecord = () => {
    if (!USE_MOCKS) {
      toast.info("This action requires the connected operations API.");
      return;
    }
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={heading.title} description={heading.description} actions={admin ? <Button size="sm" onClick={createRecord}><Plus />{actionLabel}</Button> : null} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder={`Search ${heading.title.toLowerCase()}…`} />
        <div className="flex items-center gap-2">
          {statusOptions.length > 0 ? <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem>{statusOptions.map((option) => <SelectItem key={option} value={option}>{option.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select> : null}
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
      </div>
      <DataTable data={data} columns={columns} getRowKey={keyOf} emptyState={<EmptyState icon={icon} title={emptyTitle} description="Records will appear here as your team works through the billing cycle." action={admin ? <Button size="sm" onClick={createRecord}><Plus />{actionLabel}</Button> : undefined} />} />
      <OperationCreateDialog mode={mode} snapshot={snapshot} open={open} onOpenChange={setOpen} onCreated={() => void queryClient.invalidateQueries({ queryKey: queryKeys.operations })} />
    </div>
  );
}

function OperationCreateDialog({ mode, snapshot, open, onOpenChange, onCreated }: { mode: Exclude<OperationsMode, "billing" | "reports" | "portal">; snapshot: OperationsSnapshot; open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("10000");
  const [code, setCode] = useState("");
  const [customerId, setCustomerId] = useState(snapshot.customers[0]?.id ?? "");
  const products = loadMockData().products;
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [invoiceId, setInvoiceId] = useState(snapshot.invoices[0]?.id ?? "");
  const [method, setMethod] = useState<Payment["method"]>("ONLINE");
  const [saving, setSaving] = useState(false);
  const titles: Record<typeof mode, string> = { customers: "Add customer", quotes: "New quotation", invoices: "Create invoice", payments: "Record payment", discounts: "Create discount" };
  const descriptions: Record<typeof mode, string> = { customers: "Create a customer account for subscription operations.", quotes: "Create a starter quotation from the seeded catalogue.", invoices: "Create a draft invoice for a customer.", payments: "Record a payment against the latest invoice.", discounts: "Create a percentage discount rule.", };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = loadMockData();
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 86400000).toISOString();
      const customer = data.customers.find((item) => item.id === customerId) ?? data.customers[0];
      const product = data.products.find((item) => item.id === productId) ?? data.products[0];
      if (mode === "customers") {
        const customerName = name.trim() || "New customer";
        data.customers.unshift({ id: createId("cus"), name: customerName, legalName: customerName, email: email.trim() || `${createId("contact")}@example.com`, status: "ACTIVE", createdAt: now.toISOString(), activeSubscriptions: 0, outstandingAmount: 0 });
      } else if (!customer || !product) {
        throw new Error("Create a customer and product first.");
      } else if (mode === "quotes") {
        const total = Math.max(0, Number(amount) || product.salesPrice || 0);
        data.quotes.unshift({ id: createId("quo"), number: `QUO/${now.getFullYear()}/NEW`, customerId: customer.id, customerName: customer.name, templateName: "Quick quote", status: "DRAFT", validUntil: future, total, createdAt: now.toISOString(), lines: [{ id: createId("ql"), description: product.name, quantity: 1, unitPrice: total, taxRate: product.taxRate ?? 0, amount: total }] });
      } else if (mode === "invoices") {
        const total = Math.max(0, Number(amount) || product.salesPrice || 0);
        data.invoices.unshift({ id: createId("inv"), number: `INV/${now.getFullYear()}/NEW`, customerId: customer.id, customerName: customer.name, status: "DRAFT", issueDate: now.toISOString(), dueDate: future, subtotal: total, taxAmount: 0, discountAmount: 0, total, paidAmount: 0, lines: [{ id: createId("line"), description: product.name, quantity: 1, unitPrice: total, taxRate: 0, taxAmount: 0, amount: total }] });
      } else if (mode === "payments") {
        const invoice = data.invoices.find((item) => item.id === invoiceId) ?? data.invoices.find((item) => item.status !== "PAID" && item.status !== "CANCELED");
        if (!invoice) throw new Error("Create an invoice first.");
        const paymentAmount = Math.min(Math.max(1, Number(amount) || 1), invoice.total - invoice.paidAmount);
        invoice.paidAmount += paymentAmount;
        invoice.status = invoice.paidAmount >= invoice.total ? "PAID" : "PARTIALLY_PAID";
        data.payments.unshift({ id: createId("pay"), number: `PAY/${now.getFullYear()}/NEW`, invoiceId: invoice.id, invoiceNumber: invoice.number, customerName: invoice.customerName, method, amount: paymentAmount, paymentDate: now.toISOString(), status: "CONFIRMED" });
      } else {
        data.discounts.unshift({ id: createId("dsc"), name: name.trim() || "New discount", code: code.trim().toUpperCase() || `SAVE${Math.floor(Math.random() * 90 + 10)}`, type: "PERCENTAGE", value: Math.min(100, Math.max(1, Number(amount) || 10)), minimumPurchase: 0, minimumQuantity: 1, startsAt: now.toISOString(), usedRedemptions: 0, status: "ACTIVE" });
      }
      saveMockData(data);
      onCreated();
      toast.success(`${titles[mode]} created.`);
      onOpenChange(false);
      setName(""); setEmail(""); setCode("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The record could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{titles[mode]}</DialogTitle><DialogDescription>{descriptions[mode]}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">{mode === "customers" ? <><div className="space-y-2"><Label htmlFor="customer-name">Name</Label><Input id="customer-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Acme Labs" required /></div><div className="space-y-2"><Label htmlFor="customer-email">Email</Label><Input id="customer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="billing@acme.test" required /></div></> : null}{["quotes", "invoices"].includes(mode) ? <><div className="space-y-2"><Label>Customer</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{snapshot.customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.email}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Product</Label><Select value={productId} onValueChange={setProductId}><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{products.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div></> : null}{mode === "payments" ? <><div className="space-y-2"><Label>Invoice</Label><Select value={invoiceId} onValueChange={setInvoiceId}><SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger><SelectContent>{snapshot.invoices.filter((item) => item.status !== "PAID" && item.status !== "CANCELED").map((item) => <SelectItem key={item.id} value={item.id}>{item.number} · {item.customerName}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Payment method</Label><Select value={method} onValueChange={(value) => setMethod(value as Payment["method"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["ONLINE", "CARD", "UPI", "BANK_TRANSFER", "CASH", "CHEQUE"].map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div></> : null}{mode === "discounts" ? <><div className="space-y-2"><Label htmlFor="discount-name">Name</Label><Input id="discount-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Launch discount" required /></div><div className="space-y-2"><Label htmlFor="discount-code">Code</Label><Input id="discount-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="LAUNCH20" required /></div></> : null}{["quotes", "invoices", "payments", "discounts"].includes(mode) ? <div className="space-y-2"><Label htmlFor="record-amount">{mode === "discounts" ? "Percentage" : "Amount"}</Label><Input id="record-amount" type="number" min="1" max={mode === "discounts" ? 100 : undefined} value={amount} onChange={(event) => setAmount(event.target.value)} /></div> : null}<DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function BillingView({ heading, search, setSearch, rows, columns, isAdmin }: { heading: { title: string; description: string }; search: string; setSearch: (value: string) => void; rows: BillingRun[]; columns: DataColumn<BillingRun>[]; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const runBilling = () => {
    if (!USE_MOCKS) {
      toast.info("Billing runs require the connected billing API.");
      return;
    }
    const data = loadMockData();
    const now = new Date().toISOString();
    data.billingRuns.unshift({ id: createId("run"), number: `RUN/${new Date().getFullYear()}/NEW`, billingDate: now, status: "COMPLETED", subscriptions: data.subscriptions.filter((item) => item.status === "ACTIVE").length, invoicesCreated: 0, revenue: 0, startedAt: now, completedAt: now });
    saveMockData(data);
    void queryClient.invalidateQueries({ queryKey: queryKeys.operations });
    toast.success("Billing run completed. No duplicate periods were created.");
  };
  return <div className="space-y-6"><PageHeader title={heading.title} description={heading.description} actions={isAdmin ? <Button size="sm" onClick={runBilling}><Play />Run billing</Button> : null} /><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Due today" value="128" hint="Subscriptions ready to bill" icon={ReceiptText} tone="indigo" /><StatCard label="Expected revenue" value={formatCurrency(1849200, "USD")} hint="Before taxes and discounts" icon={CircleDollarSign} tone="emerald" /><StatCard label="Last run" value="1m 42s" hint="Completed without retries" icon={RefreshCw} tone="sky" /></div><div className="flex items-center justify-between"><SearchInput value={search} onChange={setSearch} placeholder="Search billing runs…" /><span className="text-xs text-muted-foreground">{rows.length} runs</span></div><DataTable data={rows} columns={columns} getRowKey={(row) => row.id} emptyState={<EmptyState icon={RefreshCw} title="No billing runs yet" description="Run billing once subscriptions are due." action={isAdmin ? <Button size="sm" onClick={runBilling}><Play />Run billing</Button> : undefined} />} /></div>;
}

function ReportsView({ snapshot }: { snapshot: OperationsSnapshot }) {
  const summary = snapshot.summary;
  const cards = [
    ["Active subscriptions", summary.activeSubscriptions.toString(), "Across all products", CreditCard, "indigo"],
    ["MRR", formatCurrency(summary.mrr, "USD"), "Normalized monthly recurring revenue", CircleDollarSign, "emerald"],
    ["ARR", formatCurrency(summary.arr, "USD"), "Annualized recurring revenue", BarChart3, "sky"],
    ["Revenue collected", formatCurrency(summary.revenueCollected, "USD"), "Confirmed payments to date", WalletCards, "amber"],
  ] as const;
  return <div className="space-y-7"><PageHeader title="Finance dashboard" description="A month-end view of recurring revenue, collections, and receivables." actions={<Button variant="outline" size="sm" onClick={() => toast.success("Report exported.")}><ArrowUpRight />Export report</Button>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, hint, icon, tone]) => <StatCard key={label} label={label} value={value} hint={hint} icon={icon} tone={tone} />)}</div><div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><Card><CardHeader><CardTitle className="text-base">Receivables health</CardTitle><CardDescription>What still needs attention before month close.</CardDescription></CardHeader><CardContent className="space-y-5"><ReportBar label="Outstanding" value={summary.outstanding} total={summary.revenueCollected + summary.outstanding} tone="bg-amber-500" /><ReportBar label="Overdue" value={summary.overdue} total={summary.outstanding} tone="bg-red-500" /><div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4"><div><p className="text-sm font-medium">Overdue invoices</p><p className="text-xs text-muted-foreground">Prioritize these customer follow-ups.</p></div><span className="text-2xl font-semibold text-red-600">{summary.overdueCount}</span></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Finance shortcuts</CardTitle><CardDescription>Jump directly to the operational detail.</CardDescription></CardHeader><CardContent className="grid gap-2"><ReportLink href="/invoices" icon={ReceiptText} label="Review overdue invoices" value={formatCurrency(summary.overdue, "USD")} /><ReportLink href="/payments" icon={WalletCards} label="Match payments" value={formatCurrency(summary.revenueCollected, "USD")} /><ReportLink href="/billing" icon={RefreshCw} label="Review billing runs" value="2 recent runs" /></CardContent></Card></div></div>;
}

function ReportBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) { const percentage = total ? Math.min(Math.round((value / total) * 100), 100) : 0; return <div className="space-y-2"><div className="flex justify-between text-sm"><span className="font-medium">{label}</span><span className="text-muted-foreground">{formatCurrency(value, "USD")} · {percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${tone}`} style={{ width: `${percentage}%` }} /></div></div>; }

function ReportLink({ href, icon: Icon, label, value }: { href: string; icon: typeof ReceiptText; label: string; value: string }) { return <Link href={href} className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/30 hover:bg-muted/40"><span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{value}</span></span><ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>; }

function PortalView({ snapshot, subscriptions, userEmail }: { snapshot: OperationsSnapshot; subscriptions: { user: { email: string }; plan: { name: string; price: number; currency: "USD" | "EUR" | "GBP"; interval: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" }; product: { name: string }; status: string; currentPeriodEnd: string }[]; userEmail?: string }) {
  const mine = snapshot.customers.find((customer) => customer.email === userEmail);
  const ownInvoices = snapshot.invoices.filter((invoice) => invoice.customerId === mine?.id);
  const ownSubscriptions = subscriptions.filter((subscription) => subscription.user.email === userEmail);
  return <div className="space-y-7"><PageHeader title="Your Brightloop portal" description="Manage your subscriptions, invoices, and payment history without waiting on the finance team." actions={<Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><ShieldCheck /> Customer access</Badge>} /><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Active subscriptions" value={ownSubscriptions.filter((subscription) => subscription.status === "ACTIVE").length} hint="Plans currently active" icon={CreditCard} tone="indigo" /><StatCard label="Outstanding" value={formatCurrency(mine?.outstandingAmount ?? 0, "USD")} hint="Across your invoices" icon={ReceiptText} tone="amber" /><StatCard label="Paid this year" value={formatCurrency(ownInvoices.reduce((total, invoice) => total + invoice.paidAmount, 0), "USD")} hint="Confirmed payments" icon={CheckCircle2} tone="emerald" /></div><div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Your subscriptions</CardTitle><CardDescription>Pause, renew, or review your current plans.</CardDescription></CardHeader><CardContent className="space-y-3">{ownSubscriptions.length ? ownSubscriptions.map((subscription) => <div key={`${subscription.product.name}-${subscription.plan.name}`} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-medium">{subscription.plan.name}</p><p className="text-xs text-muted-foreground">{subscription.product.name} · renews {formatDate(subscription.currentPeriodEnd)}</p></div><div className="text-right"><StatusBadge status={subscription.status} /><p className="mt-1 text-xs font-medium">{formatCurrency(subscription.plan.price, subscription.plan.currency)}{subscription.plan.interval === "MONTHLY" ? "/mo" : ""}</p></div></div>) : <EmptyState icon={CreditCard} title="No active subscriptions" description="Browse the catalog to choose a plan." />}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Recent invoices</CardTitle><CardDescription>Download, pay, or view invoice detail.</CardDescription></CardHeader><CardContent className="space-y-3">{ownInvoices.length ? ownInvoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-medium">{invoice.number}</p><p className="text-xs text-muted-foreground">Due {formatDate(invoice.dueDate)}</p></div><div className="text-right"><StatusBadge status={invoice.status} /><p className="mt-1 text-sm font-semibold">{formatCurrency(invoice.total, "USD")}</p></div></div>) : <EmptyState icon={ReceiptText} title="No invoices yet" description="Your invoices will appear here after billing." />}</CardContent></Card></div></div>;
}

function OperationsSkeleton({ title }: { title: string }) { return <div className="space-y-6"><PageHeader title={title} description="Loading operational records…" /><div className="h-10 w-full animate-pulse rounded-xl bg-muted" /><div className="h-96 animate-pulse rounded-xl border bg-card" /></div>; }
