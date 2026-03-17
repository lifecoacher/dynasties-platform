import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, Users, Building2, MapPin, Mail, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";

interface Customer {
  id: string;
  name: string;
  normalizedName: string;
  entityType: string;
  status: string;
  city: string | null;
  country: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
}

function getBaseUrl() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export default function CustomersPage() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedSearch) params.set("q", debouncedSearch);

    fetch(`${getBaseUrl()}/api/customers?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body) => {
        setCustomers(body.data || []);
        setTotal(body.pagination?.total || body.data?.length || 0);
      })
      .catch(() => setCustomers([]))
      .finally(() => setIsLoading(false));
  }, [token, page, debouncedSearch]);

  const totalPages = Math.ceil(total / limit);

  return (
    <AppLayout>
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Customers</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">{total} customers in your organization</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 pr-4 py-2 rounded-lg bg-card border border-card-border text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all w-56"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-[15px] font-semibold text-foreground mb-1">No customers found</h3>
            <p className="text-[13px] text-muted-foreground">Import customers or create your first one.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {customers.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-4 rounded-xl bg-card border border-card-border hover:border-primary/20 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-semibold text-foreground truncate">{c.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          c.status === "VERIFIED"
                            ? "bg-primary/10 text-primary"
                            : "bg-primary/10 text-primary"
                        }`}>
                          {c.status}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{c.entityType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {(c.city || c.country) && (
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{[c.city, c.country].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {c.contactEmail && (
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{c.contactEmail}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-card border border-card-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[13px] text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-card border border-card-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
