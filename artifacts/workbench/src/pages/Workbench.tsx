import { useState } from "react";
import { useListShipments } from "@workspace/api-client-react";
import { ShipmentCard } from "@/components/ShipmentCard";
import { Ship, Filter, Search, Loader2, Brain, Activity } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

type FilterTab = 'ALL' | 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export default function Workbench() {
  const { data: response, isLoading, error } = useListShipments();
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [search, setSearch] = useState('');

  const shipments = response?.data || [];
  
  const filteredShipments = shipments.filter(s => {
    const matchesTab = activeTab === 'ALL' || s.status === activeTab;
    const matchesSearch = 
      s.reference.toLowerCase().includes(search.toLowerCase()) ||
      s.shipper?.name.toLowerCase().includes(search.toLowerCase()) ||
      s.consignee?.name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  if (error) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="glass-panel p-8 text-center text-destructive max-w-md">
          <p className="font-bold text-lg mb-2">Error loading shipments</p>
          <p className="text-sm opacity-80">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 mt-4">
        <div>
          <h1 className="text-4xl font-display font-extrabold text-foreground mb-2 flex items-center gap-3">
            <Ship className="w-8 h-8 text-primary" />
            Operator Workbench
          </h1>
          <p className="text-muted-foreground text-lg">
            Review and approve AI-generated shipment drafts.
          </p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium shrink-0">
            <Activity className="w-3 h-3" />
            <span className="hidden sm:inline">Agents active</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          </div>
          <Link
            href="/intelligence"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-sm transition-all border border-primary/20 shrink-0"
          >
            <Brain className="w-4 h-4" />
            Intelligence
          </Link>
          <div className="relative flex-grow md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search reference or party..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {(['ALL', 'DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab 
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
                : 'bg-card text-muted-foreground hover:bg-secondary border border-border/50'
            }`}
          >
            {tab === 'PENDING_REVIEW' ? 'Pending Review' : tab.replace(/_/g, ' ')}
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-background/20 text-xs">
              {tab === 'ALL' ? shipments.length : shipments.filter(s => s.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-primary">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="font-medium animate-pulse">Loading shipments pipeline...</p>
        </div>
      ) : filteredShipments.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass-panel rounded-2xl p-12 text-center border-dashed border-2 border-border"
        >
          <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-foreground mb-2">No shipments found</h3>
          <p className="text-muted-foreground">
            No shipments match the current filters. Wait for the extraction agent to process new emails.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShipments.map((shipment) => (
            <ShipmentCard key={shipment.id} shipment={shipment as any} />
          ))}
        </div>
      )}
    </div>
  );
}
