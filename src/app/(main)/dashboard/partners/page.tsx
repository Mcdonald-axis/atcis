"use client";

import { useAppRecords } from "@/hooks/use-app-records";

import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Handshake, Mail, MapPin, Phone, Plus, Search, ShieldCheck, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuthService } from "@/services/auth-service";

interface PartnerCompany {
  id: string;
  name: string;
  countryCode: "ZW" | "ZM";
  city: string;
  specialization: string;
  tier: "Tier 1 Prime" | "Tier 2 Specialist" | "Subcontractor";
  pastProjectsWon: number;
  ndaStatus: "Signed" | "In Review";
  contactPerson: string;
  phone: string;
  email: string;
  rating: number;
}

export default function PartnerDirectoryPage() {
  const [currentUser, setCurrentUser] = useState(() => AuthService.getCurrentUser());
  useEffect(() => {
    const sync = () => setCurrentUser(AuthService.getCurrentUser());
    window.addEventListener("atcis-auth-changed", sync);
    return () => window.removeEventListener("atcis-auth-changed", sync);
  }, []);

  const isCountryAdmin = currentUser?.role === "country_admin";
  const userCountry = isCountryAdmin
    ? (currentUser.country === "ZM" ? "ZM" : "ZW")
    : currentUser?.role !== "super_admin" && currentUser?.country && currentUser.country !== "ALL"
    ? currentUser.country
    : "ALL";

  const allPartners = useAppRecords<PartnerCompany>("partner");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    return allPartners.filter((p) => {
      if (userCountry !== "ALL" && p.countryCode !== userCountry) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.specialization.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allPartners, userCountry, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="font-bold text-2xl tracking-tight text-foreground sm:text-3xl">
            Partner & Subcontractor Directory
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Pre-vetted consortium partners, technical specialists, and joint-venture contractors across SADC.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5 text-xs font-medium">
            <Plus className="size-3.5" /> Register New Partner
          </Button>
        </div>
      </div>

      {/* Directory Table */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Vetted Consortium Network</CardTitle>
              <CardDescription>
                Search partner companies by technical specialization, city, or past project record.
              </CardDescription>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search partner, skill, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-60 pl-8 text-xs sm:w-72"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border/50">
            <Table>
              <TableHeader className="bg-muted/40 text-xs">
                <TableRow>
                  <TableHead>Partner Company & Base</TableHead>
                  <TableHead>Technical Specialization</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-center">Past Won Projects</TableHead>
                  <TableHead>NDA Status</TableHead>
                  <TableHead>Key Contact</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {filtered.map((partner) => (
                  <TableRow key={partner.id} className="transition-colors hover:bg-muted/30">
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded border border-border bg-muted px-1.5 py-0.2 font-mono text-[10px] font-semibold text-foreground">
                            {partner.countryCode}
                          </span>
                          <span className="font-semibold text-foreground">{partner.name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="size-3" />
                          <span>{partner.city}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[240px] text-foreground">
                      {partner.specialization}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {partner.tier}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold text-foreground">
                      {partner.pastProjectsWon} bids
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="size-3" /> Signed
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        <p className="font-medium text-foreground">{partner.contactPerson}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{partner.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                        <Handshake className="mr-1 size-3" /> Joint Bid
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
