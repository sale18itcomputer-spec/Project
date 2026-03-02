'use client';

import React, { useMemo, useState, useEffect } from 'react';
import MetricCard from "../common/MetricCard";
import ProjectOutcomeChart from "../charts/ProjectOutcomeChart";
import { useB2BData } from "../../hooks/useB2BData";
import { ProjectStatusData } from "../../types";
import MonthlyWinValueChart from "../charts/MonthlyWinValueChart";
import TopCustomersChart from "../charts/TopCustomersChart";
import SalesByBrandChart from "../charts/ProjectsByBrandChart";
import WinRateChart from "../charts/WinRateChart";
import { useNavigation } from "../../contexts/NavigationContext";
import { FilterProvider, useFilter } from "../../contexts/FilterContext";
import DashboardFilterBar from "./components/DashboardFilterBar";
import { calculateDueDate, parseDate } from "../../utils/time";
import { parseSheetValue } from "../../utils/formatters";
import AnalyticsDashboard from "./AnalyticsDashboard";
import PendingWorks from "./PendingWorks";

import { useAuth } from "../../contexts/AuthContext";
import { Briefcase, Building, Users, MessageSquare, ClipboardList, Calendar } from 'lucide-react';
import { useB2B } from "../../contexts/B2BContext";

import { useWindowSize } from "../../hooks/useWindowSize";

const DashboardContentSkeleton = () => (
  <div className="space-y-6">
    {/* Metric Cards - 6 grid */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-card p-5 rounded-xl border border-border shadow-sm h-[104px] flex flex-col justify-between animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="flex justify-between items-start">
            <div className="h-4 bg-muted rounded w-2/3 animate-pulse"></div>
            <div className="h-8 w-8 bg-muted rounded-full animate-pulse"></div>
          </div>
          <div className="h-6 bg-muted rounded w-1/2 animate-pulse self-end mt-2"></div>
        </div>
      ))}
    </div>

    {/* Filter Bar Placeholder */}
    <div className="h-16 bg-card rounded-xl border border-border shadow-sm animate-pulse"></div>

    {/* Large Chart */}
    <div className="h-96 bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div className="h-6 w-48 bg-muted rounded animate-pulse"></div>
        <div className="h-8 w-32 bg-muted rounded animate-pulse"></div>
      </div>
      <div className="h-64 bg-muted/30 rounded-lg animate-pulse"></div>
    </div>

    {/* Grouped Section */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 h-80 bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
        <div className="h-5 w-1/3 bg-muted rounded mb-4 animate-pulse"></div>
        <div className="flex-1 bg-muted/30 rounded-lg h-56 animate-pulse"></div>
      </div>
      <div className="h-80 bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
        <div className="h-5 w-1/2 bg-muted rounded mb-4 animate-pulse"></div>
        <div className="flex-1 bg-muted/30 rounded-lg h-56 animate-pulse"></div>
      </div>
    </div>
  </div>
);

const DashboardContent: React.FC = () => {
  const { projects, companies, contacts, contactLogs, siteSurveys, meetings, loading, error, saleOrders, quotations, pricelist } = useB2BData();
  const { handleNavigation } = useNavigation();
  const { currentUser } = useAuth();
  const { filters } = useFilter();
  const { isB2B } = useB2B();
  const [renderStep, setRenderStep] = useState(0);
  const [revenuePeriod, setRevenuePeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [isFilterMenuOpen, setFilterMenuOpen] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width < 768;

  useEffect(() => {
    if (!loading) {
      const timeouts: ReturnType<typeof setTimeout>[] = [];
      // Faster staggered animation (50ms steps)
      for (let i = 1; i <= 8; i++) {
        timeouts.push(setTimeout(() => setRenderStep(i), i * 50));
      }
      return () => timeouts.forEach(clearTimeout);
    }
  }, [loading]);

  const currencyFilter = filters.currency || 'USD';

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    const hasFilters = Object.values(filters).some(val => Array.isArray(val) ? val.length > 0 : !!val);
    if (!hasFilters) return projects;

    return projects.filter(p => {
      const hasYearFilter = filters.year?.length && filters.year.length > 0;
      const hasDateRange = !!(filters.startDate || filters.endDate);
      const currentYear = new Date().getFullYear();

      // Default to Current Year if no explicit Year or valid Date Range is provided.
      // This applies even if 'Month' is filtered (e.g. "January" defaults to "January of Current Year").
      const constrainToCurrentYear = !hasYearFilter && !hasDateRange;

      if (filters.status?.length && !filters.status.includes(p.Status)) return false;
      if (filters.responsibleBy?.length && !filters.responsibleBy.includes(p['Responsible By'])) return false;
      if (filters.companyName?.length && !filters.companyName.includes(p['Company Name'])) return false;
      if (filters.brand1?.length && !filters.brand1.includes(p['Brand 1'])) return false;

      const projectCreatedDate = parseDate(p['Created Date']);
      if (!projectCreatedDate) {
        // If we can't parse the date, and we are constraining to current year, exclude it.
        // If we represent "All Time" (which is only possible if user explicitly selects ALL years, logic above prevents implicit All Time), 
        // we might want to keep it? No, safe to exclude invalid dates when date logic is involved.
        // However, if standard filters are off, we might hide data. 
        // Best to return false if date is invalid and we rely on date filtering.
        return false;
      }

      if (constrainToCurrentYear) {
        // Relaxing this to avoid filtering out data when no explicit filter is set.
        // The charts and lists will still default to sensible views.
        // if (projectCreatedDate.getFullYear() !== currentYear) return false;
      }

      if (filters.startDate) {
        const startDate = new Date(`${filters.startDate}T00:00:00.000+07:00`);
        if (projectCreatedDate < startDate) return false;
      }
      if (filters.endDate) {
        const endDate = new Date(`${filters.endDate}T23:59:59.999+07:00`);
        if (projectCreatedDate > endDate) return false;
      }
      if (filters.year?.length) {
        const projectYear = projectCreatedDate.getFullYear();
        if (!filters.year.map(Number).includes(projectYear)) return false;
      }
      if (filters.month?.length) {
        const projectMonth = projectCreatedDate.toLocaleString('en-US', { month: 'long' });
        if (!filters.month.includes(projectMonth)) return false;
      }

      return true;
    });
  }, [projects, filters]);

  const filterOptions = useMemo(() => {
    // Initialize with safe defaults
    const defaults = { statuses: [], assignees: [], companies: [], brands: [], months: [], years: [] };
    if (!projects && !saleOrders) return defaults;

    const statuses = new Set<string>();
    const assignees = new Set<string>();
    const companies = new Set<string>();
    const brands = new Set<string>();
    // We want ALL months to be available regardless of data
    const years = new Set<number>();

    // Ensure current year is always available
    years.add(new Date().getFullYear());

    // Helper to process dates
    const processDate = (dateStr: string | undefined) => {
      if (!dateStr) return;
      const date = parseDate(dateStr);
      if (date) {
        years.add(date.getFullYear());
      }
    };

    if (projects) {
      projects.forEach(p => {
        if (p.Status) statuses.add(p.Status);
        if (p['Responsible By']) assignees.add(p['Responsible By']);
        if (p['Company Name']) companies.add(p['Company Name']);
        if (p['Brand 1'] && p['Brand 1'].trim() !== '' && p['Brand 1'].trim() !== 'N/A') {
          brands.add(p['Brand 1']);
        }
        processDate(p['Created Date']);
      });
    }

    if (saleOrders) {
      saleOrders.forEach(so => {
        // We might want to filter companies/etc from SOs too? 
        // For now, user specifically asked about Year/Month. 
        // But consistency suggests we might want companies there too if they only exist in SOs?
        // Let's stick to just Dates for now to be safe, as SOs don't have 'Status' same as Projects.
        processDate(so['SO Date']);
      });
    }

    // Always show all months in order
    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const sortedYears = Array.from(years).sort((a, b) => b - a);

    return {
      statuses: Array.from(statuses).sort(),
      assignees: Array.from(assignees).sort(),
      companies: Array.from(companies).sort(),
      brands: Array.from(brands).sort(),
      months: monthOrder,
      years: sortedYears,
    };
  }, [projects, saleOrders]);

  const processedFilteredProjects = useMemo(() => {
    return filteredProjects.map(project => ({
      ...project,
      calculatedDueDate: calculateDueDate(project['Created Date'], project['Time Frame'])
    }));
  }, [filteredProjects]);

  const totalWinValue = useMemo(() => {
    return filteredProjects
      .filter(p => {
        if (p.Status !== 'Close (win)') return false;
        if (currencyFilter === 'USD') return p.Currency !== 'KHR';
        return p.Currency === currencyFilter;
      })
      .reduce((acc, project) => {
        const value = parseSheetValue(project['Bid Value']);
        return acc + value;
      }, 0);
  }, [filteredProjects, currencyFilter]);

  const winRateData = useMemo(() => {
    const wonCount = filteredProjects.filter(p => p.Status === 'Close (win)').length;
    const lostCount = filteredProjects.filter(p => p.Status === 'Close (lose)').length;
    const total = wonCount + lostCount;
    const winRate = total > 0 ? (wonCount / total) * 100 : 0;
    return { winRate, won: wonCount, total };
  }, [filteredProjects]);


  const validContactsCount = useMemo(() => {
    if (!contacts) return 0;
    return contacts.filter(c => c.Name && c.Name.trim() !== '').length;
  }, [contacts]);

  // B2B-specific metrics (only Companies and Pipelines)
  const b2bMetrics = [
    { title: 'Total Pipelines', value: loading ? '...' : (projects?.length ?? 0).toString(), onClick: () => handleNavigation({ view: 'projects' }), icon: <Briefcase /> },
    { title: 'Total Companies', value: loading ? '...' : (companies?.length ?? 0).toString(), onClick: () => handleNavigation({ view: 'companies' }), icon: <Building /> },
  ];

  // B2C metrics (all metrics)
  const b2cMetrics = [
    { title: 'Total Pipelines', value: loading ? '...' : (projects?.length ?? 0).toString(), onClick: () => handleNavigation({ view: 'projects' }), icon: <Briefcase /> },
    { title: 'Total Companies', value: loading ? '...' : (companies?.length ?? 0).toString(), onClick: () => handleNavigation({ view: 'companies' }), icon: <Building /> },
    { title: 'Total Contacts', value: loading ? '...' : validContactsCount.toString(), onClick: () => handleNavigation({ view: 'contacts' }), icon: <Users /> },
    { title: 'Total Activities', value: loading ? '...' : (contactLogs?.length ?? 0).toString(), onClick: () => handleNavigation({ view: 'contact-logs' }), icon: <MessageSquare /> },
    { title: 'Total Surveys', value: loading ? '...' : (siteSurveys?.length ?? 0).toString(), onClick: () => handleNavigation({ view: 'site-surveys' }), icon: <ClipboardList /> },
    { title: 'Total Meetings', value: loading ? '...' : (meetings?.length ?? 0).toString(), onClick: () => handleNavigation({ view: 'meetings' }), icon: <Calendar /> },
  ];

  const metrics = isB2B ? b2bMetrics : b2cMetrics;

  const projectOutcomeData = useMemo<ProjectStatusData[]>(() => {
    const baseData = filteredProjects;
    if (!baseData) return [];

    const statusCounts = baseData.reduce((acc, project) => {
      const status = project.Status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [projects, filteredProjects, filters.status]);

  const revenueByPeriodData = useMemo(() => {
    const rawData = isB2B ? projects : saleOrders;
    if (!rawData) return { chartData: [] };

    const currentYear = new Date().getFullYear();

    // Filter Items for Revenue
    const relevantItems = rawData.filter(item => {
      // Status check
      if (isB2B) {
        // B2B: Pipelines that are 'Close (win)' - handle various casing (e.g., 'Close (Win)')
        const status = item.Status?.toLowerCase();
        if (status !== 'close (win)') return false;
      } else {
        // B2C: Sale Orders that are 'Completed'
        if (item.Status !== 'Completed') return false;
      }

      // Currency check
      if (currencyFilter === 'USD') {
        if (item.Currency === 'KHR') return false;
      } else {
        if (item.Currency !== currencyFilter) return false;
      }

      // Apply relevant global filters
      if (filters.companyName?.length && !filters.companyName.includes(item['Company Name'])) return false;

      const itemAny = item as any;
      const dateStr = isB2B ? (itemAny['Inv Date'] || itemAny['Created Date']) : itemAny['SO Date'];
      const date = parseDate(dateStr);
      if (!date) return false;

      const hasYearFilter = filters.year?.length && filters.year.length > 0;
      const hasDateRange = !!(filters.startDate || filters.endDate);
      const constrainToCurrentYear = !hasYearFilter && !hasDateRange;

      if (constrainToCurrentYear) {
        if (date.getFullYear() !== currentYear) return false;
      }

      if (filters.startDate) {
        const startDate = new Date(`${filters.startDate}T00:00:00.000+07:00`);
        if (date < startDate) return false;
      }
      if (filters.endDate) {
        const endDate = new Date(`${filters.endDate}T23:59:59.999+07:00`);
        if (date > endDate) return false;
      }
      if (filters.year?.length) {
        const year = date.getFullYear();
        if (!filters.year.map(Number).includes(year)) return false;
      }
      if (filters.month?.length) {
        const month = date.toLocaleString('en-US', { month: 'long' });
        if (!filters.month.includes(month)) return false;
      }

      return true;
    });

    const getQuarter = (date: Date) => `Q${Math.floor(date.getMonth() / 3) + 1}`;

    // Helper to determine which years to display
    const yearsToDisplay: number[] = [];
    if (filters.year?.length) {
      yearsToDisplay.push(...filters.year.map(Number));
    } else if (!filters.startDate && !filters.endDate) {
      // DEFAULT: If no specific date filter is set, show only the current year.
      // This fulfills the "monthly of current year" requirement.
      yearsToDisplay.push(currentYear);
    } else {
      // If date range exists, determine all years covered by the range
      const startYear = filters.startDate ? parseDate(filters.startDate)?.getFullYear() : null;
      const endYear = filters.endDate ? parseDate(filters.endDate)?.getFullYear() : null;

      if (startYear && endYear) {
        const minYear = Math.min(startYear, endYear);
        const maxYear = Math.max(startYear, endYear);
        for (let y = minYear; y <= maxYear; y++) {
          yearsToDisplay.push(y);
        }
      } else if (startYear) {
        yearsToDisplay.push(startYear);
      } else if (endYear) {
        yearsToDisplay.push(endYear);
      }
    }

    // Initialize aggregation with all periods (months/quarters) for the target years to ensure full chart x-axis
    const initialAggregation: { [key: string]: { winValue: number; projectCount: number } } = {};

    yearsToDisplay.forEach(year => {
      if (revenuePeriod === 'monthly') {
        for (let m = 1; m <= 12; m++) {
          const key = `${year}-${String(m).padStart(2, '0')}`;
          initialAggregation[key] = { winValue: 0, projectCount: 0 };
        }
      } else if (revenuePeriod === 'quarterly') {
        for (let q = 1; q <= 4; q++) {
          const key = `${year}-Q${q}`;
          initialAggregation[key] = { winValue: 0, projectCount: 0 };
        }
      } else if (revenuePeriod === 'yearly') {
        initialAggregation[`${year}`] = { winValue: 0, projectCount: 0 };
      }
    });

    const aggregation = relevantItems.reduce((acc, item) => {
      const itemAny = item as any;
      const amountVal = isB2B ? itemAny['Bid Value'] : itemAny['Total Amount'];
      const totalAmount = parseSheetValue(amountVal);
      const dateStr = isB2B ? (itemAny['Inv Date'] || itemAny['Created Date']) : itemAny['SO Date'];

      // Calculate subtotal by subtracting VAT from total
      let subtotal = totalAmount;
      if (isB2B) {
        // B2B: Use 'Taxable' field
        if (itemAny.Taxable === 'VAT' && totalAmount > 0) {
          subtotal = totalAmount / 1.1;
        }
      } else {
        // B2C: Use 'Tax' field or 'Bill Invoice'
        const taxAmount = parseSheetValue(itemAny['Tax']);
        if (taxAmount > 0) {
          subtotal = totalAmount - taxAmount;
        } else if (itemAny['Bill Invoice'] === 'VAT' && totalAmount > 0) {
          subtotal = totalAmount / 1.1;
        }
      }

      if (subtotal > 0 && dateStr) {
        const date = parseDate(dateStr);
        if (date) {
          let key = '';
          const year = date.getFullYear();

          switch (revenuePeriod) {
            case 'monthly':
              key = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              break;
            case 'quarterly':
              key = `${year}-${getQuarter(date)}`;
              break;
            case 'yearly':
              key = `${year}`;
              break;
          }

          if (key) {
            if (!acc[key]) {
              acc[key] = { winValue: 0, projectCount: 0 };
            }
            acc[key].winValue += subtotal;
            acc[key].projectCount += 1;
          }
        }
      }
      return acc;
    }, initialAggregation);

    const chartData = Object.entries(aggregation)
      .map(([key, value]: [string, { winValue: number; projectCount: number }]) => {
        const { winValue, projectCount } = value;
        let name = '';
        switch (revenuePeriod) {
          case 'monthly': {
            const [year, month] = key.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            name = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            break;
          }
          case 'quarterly': {
            const [qYear, quarter] = key.split('-');
            name = `${quarter} ${qYear}`;
            break;
          }
          case 'yearly':
            name = key;
            break;
        }
        return { name, winValue, projectCount, sortKey: key };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return { chartData };
  }, [saleOrders, projects, isB2B, revenuePeriod, currencyFilter, filters]);

  const [customerPeriod, setCustomerPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('yearly');

  const topCustomersData = useMemo(() => {
    if (!saleOrders) return [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3);

    const relevantSOs = saleOrders.filter(so => {
      // 1. Status: Filter out Cancelled orders
      if (so.Status === 'Cancel') return false;

      // 2. Currency Filter
      if (currencyFilter === 'USD') {
        if (so.Currency === 'KHR') return false;
      } else {
        if (so.Currency !== currencyFilter) return false;
      }

      // 3. Date Parsing
      const date = parseDate(so['SO Date']);
      if (!date) return false;

      // 4. Period Scoping (relative to now)
      // Only apply if NO global date range/year/month filter is active
      const hasDateFilter = !!(filters.startDate || filters.endDate || filters.year?.length || filters.month?.length);

      if (!hasDateFilter) {
        const itemYear = date.getFullYear();
        if (customerPeriod === 'yearly') {
          if (itemYear !== currentYear) return false;
        } else if (customerPeriod === 'monthly') {
          if (itemYear !== currentYear || date.getMonth() !== currentMonth) return false;
        } else if (customerPeriod === 'quarterly') {
          const itemQuarter = Math.floor(date.getMonth() / 3);
          if (itemYear !== currentYear || itemQuarter !== currentQuarter) return false;
        }
      }

      // 5. Global Dashboard Filters (if active)
      if (filters.startDate) {
        const start = new Date(`${filters.startDate}T00:00:00.000+07:00`);
        if (date < start) return false;
      }
      if (filters.endDate) {
        const end = new Date(`${filters.endDate}T23:59:59.999+07:00`);
        if (date > end) return false;
      }
      if (filters.year?.length) {
        if (!filters.year.map(Number).includes(date.getFullYear())) return false;
      }
      if (filters.month?.length) {
        const m = date.toLocaleString('en-US', { month: 'long' });
        if (!filters.month.includes(m)) return false;
      }
      if (filters.companyName?.length && !filters.companyName.includes(so['Company Name'])) return false;

      return true;
    });

    const customerValues = relevantSOs.reduce((acc, so) => {
      const customer = so['Company Name'];
      const amount = parseSheetValue(so['Total Amount']);
      if (customer && amount > 0) {
        if (!acc[customer]) {
          acc[customer] = { winValue: 0, projectCount: 0 };
        }
        acc[customer].winValue += amount;
        acc[customer].projectCount += 1;
      }
      return acc;
    }, {} as { [key: string]: { winValue: number, projectCount: number } });

    return Object.entries(customerValues)
      .map(([name, value]: [string, { winValue: number, projectCount: number }]) => ({ name, winValue: value.winValue, projectCount: value.projectCount }))
      .sort((a, b) => b.winValue - a.winValue)
      .slice(0, 10);
  }, [saleOrders, filters, currencyFilter, customerPeriod]);

  const salesByBrandData = useMemo(() => {
    if (!saleOrders || !pricelist) return [];

    const brandMap = new Map<string, string>();
    pricelist.forEach(item => {
      if (item.Code && item.Brand) {
        brandMap.set(item.Code.trim(), item.Brand.trim());
      }
    });

    const brandStats: Record<string, { count: number; totalValue: number }> = {};

    saleOrders.forEach(so => {
      if (so.Status === 'Cancel') return;

      // 1. Currency Filter
      if (currencyFilter === 'USD') {
        if (so.Currency === 'KHR') return;
      } else {
        if (so.Currency !== currencyFilter) return;
      }

      // 2. Date Filters
      const date = parseDate(so['SO Date']);
      if (!date) return;

      if (filters.startDate) {
        const start = new Date(`${filters.startDate}T00:00:00.000+07:00`);
        if (date < start) return;
      }
      if (filters.endDate) {
        const end = new Date(`${filters.endDate}T23:59:59.999+07:00`);
        if (date > end) return;
      }
      if (filters.year?.length) {
        if (!filters.year.map(Number).includes(date.getFullYear())) return;
      }
      if (filters.month?.length) {
        const m = date.toLocaleString('en-US', { month: 'long' });
        if (!filters.month.includes(m)) return;
      }
      if (filters.companyName?.length && !filters.companyName.includes(so['Company Name'])) return;

      // 3. Extract Brands from Items
      let items: any[] = [];
      try {
        items = typeof so.ItemsJSON === 'string' ? JSON.parse(so.ItemsJSON) : (so.ItemsJSON || []);
      } catch (e) {
        // ignore parse errors
      }

      const uniqueBrandsInSO = new Set<string>();
      items.forEach(item => {
        const brand = item.brand || brandMap.get(String(item.itemCode || '').trim()) || 'Unknown';
        if (brand === 'N/A' || brand === 'Unknown' || brand === '') return;

        if (!brandStats[brand]) {
          brandStats[brand] = { count: 0, totalValue: 0 };
        }

        const itemAmount = parseSheetValue(item.amount);
        brandStats[brand].totalValue += itemAmount;
        uniqueBrandsInSO.add(brand);
      });

      uniqueBrandsInSO.forEach(brand => {
        brandStats[brand].count += 1;
      });
    });

    return Object.entries(brandStats)
      .map(([name, value]) => ({
        name,
        count: value.count,
        totalValue: value.totalValue
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [saleOrders, pricelist, filters, currencyFilter]);


  if (loading && !projects) {
    return <DashboardContentSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
        <p className="font-bold">Error</p>
        <p>Could not load dashboard data: {error}</p>
      </div>
    );
  }

  const transitionClass = (step: number) =>
    `transition-all duration-500 ease-out transform ${renderStep >= step ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`;

  return (
    <div className="space-y-6 p-4 md:p-0 dashboard-container">
      {renderStep >= 1 && (
        <div className={`grid ${isB2B ? 'grid-cols-2 gap-4 md:gap-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5'} metric-cards-grid ${transitionClass(1)}`}>
          {metrics.map((metric) => (
            <MetricCard
              key={metric.title}
              title={metric.title}
              value={metric.value}
              change=""
              changeType={'increase'}
              onClick={metric.onClick}
              icon={metric.icon}
              isCompact={true}
            />
          ))}
        </div>
      )}

      {renderStep >= 2 && (
        <div className={`${transitionClass(2)} ${isFilterMenuOpen ? 'relative z-10' : ''}`}>
          <DashboardFilterBar
            statuses={filterOptions.statuses}
            assignees={filterOptions.assignees}
            companies={filterOptions.companies}
            brands={filterOptions.brands}
            months={filterOptions.months}
            years={filterOptions.years}
            onMenuVisibilityChange={setFilterMenuOpen}
          />
        </div>
      )}

      {/* Detailed Revenue Charts - NOW TOP PRIORITY */}
      {renderStep >= 3 && (
        <div className={`${transitionClass(3)} h-[320px] lg:h-[400px] chart-container min-w-0`}>
          <MonthlyWinValueChart
            data={revenueByPeriodData.chartData}
            period={revenuePeriod}
            onPeriodChange={setRevenuePeriod}
            currency={currencyFilter}
            isB2B={isB2B}
          />
        </div>
      )}

      {/* Unified Analytics Dashboard Section */}
      {renderStep >= 4 && (
        <div className={transitionClass(4)}>
          <AnalyticsDashboard />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Keep Project Outcome Chart in both modes */}
        {renderStep >= 6 && (
          <div className={`${transitionClass(6)} h-[350px] lg:h-[420px] chart-container min-w-0`}>
            <ProjectOutcomeChart data={projectOutcomeData} />
          </div>
        )}

        {/* Pending Works Section */}
        {renderStep >= 6 && (
          <div className={`${transitionClass(6)} h-[350px] lg:h-[420px] chart-container min-w-0`}>
            <PendingWorks />
          </div>
        )}
      </div>

      {/* Show Top Customers and Projects by Brand charts in both modes */}
      <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-3'} gap-6`}>
        {renderStep >= 7 && (
          <div className={`${isMobile ? '' : 'lg:col-span-2'} ${transitionClass(7)} h-[320px] lg:h-[400px] chart-container min-w-0`}>
            <TopCustomersChart
              data={topCustomersData}
              totalWinValue={totalWinValue}
              currency={currencyFilter}
            />
          </div>
        )}
        {renderStep >= 8 && (
          <div className={`${isMobile ? '' : 'lg:col-span-1'} ${transitionClass(8)} h-[320px] lg:h-[400px] chart-container min-w-0`}>
            <SalesByBrandChart data={salesByBrandData} currency={currencyFilter} />
          </div>
        )}
      </div>
    </div>
  );
};

const MemoizedDashboardContent = React.memo(DashboardContent);

const Dashboard: React.FC = () => (
  <FilterProvider>
    <MemoizedDashboardContent />
  </FilterProvider>
);

export default Dashboard;
