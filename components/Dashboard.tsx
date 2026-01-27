import React, { useMemo, useState, useEffect } from 'react';
import MetricCard from './MetricCard';
import ProjectOutcomeChart from './ProjectOutcomeChart';
import { useB2BData } from '../hooks/useB2BData';
import { ProjectStatusData, PendingWorkItem } from '../types';
import MonthlyWinValueChart from './MonthlyWinValueChart';
import TopCustomersChart from './TopCustomersChart';
import ProjectsByBrandChart from './ProjectsByBrandChart';
import WinRateChart from './WinRateChart';
import { useNavigation } from '../contexts/NavigationContext';
import { FilterProvider, useFilter } from '../contexts/FilterContext';
import DashboardFilterBar from './DashboardFilterBar';
import { calculateDueDate, parseDate } from '../utils/time';
import { parseSheetValue } from '../utils/formatters';
import PendingWorks from './PendingWorks';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, Building, Users, MessageSquare, ClipboardList, Calendar } from 'lucide-react';
import { useB2B } from '../contexts/B2BContext';

import { useWindowSize } from '../hooks/useWindowSize';

const DashboardContentSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {/* Metric Cards */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-card p-5 rounded-xl border">
          <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
          <div className="h-8 bg-muted rounded w-1/2"></div>
        </div>
      ))}
    </div>

    {/* Filter Bar Placeholder */}
    <div className="h-16 bg-card rounded-xl border"></div>

    {/* Large Chart */}
    <div className="h-96 bg-card rounded-xl border p-6">
      <div className="h-6 w-1/3 bg-muted rounded mb-4"></div>
      <div className="h-4 w-1/2 bg-muted rounded mb-6"></div>
      <div className="h-64 bg-muted/50 rounded-lg"></div>
    </div>

    {/* Grouped Section */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-80 bg-card rounded-xl border p-6">
          <div className="h-5 w-1/2 bg-muted rounded mb-4"></div>
          <div className="h-4 w-3/4 bg-muted rounded mb-6"></div>
          <div className="h-48 bg-muted/50 rounded-lg"></div>
        </div>
      ))}
    </div>
  </div>
);

const DashboardContent: React.FC = () => {
  const { projects, companies, contacts, contactLogs, siteSurveys, meetings, loading, error, saleOrders } = useB2BData();
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
      for (let i = 1; i <= 8; i++) {
        timeouts.push(setTimeout(() => setRenderStep(i), i * 100));
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

  const pendingWorks = useMemo(() => {
    // ... code for pending works remains SAME ...
    // Get the current date at midnight in UTC+7 to match the timezone of parsed dates from sheets.
    const now = new Date();
    const todayStrInUTC7 = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const today = parseDate(todayStrInUTC7);

    // If today can't be parsed, we can't calculate pending items.
    if (!today) {
      console.error("Could not determine today's date for pending works.");
      return { todayItems: [], upcomingItems: [] };
    }

    const endOfUpcoming = new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000); // Today + 8 days to include the 7th day

    const todayItems: PendingWorkItem[] = [];
    const upcomingItems: PendingWorkItem[] = [];

    if (processedFilteredProjects) {
      processedFilteredProjects.forEach(p => {
        if (p['Responsible By'] !== currentUser?.Name) return;

        // Use the calculatedDueDate directly. It's already a Date object at midnight UTC+7.
        const dueDate = p.calculatedDueDate;
        if (p.Status === 'Quote Submitted' && dueDate) {
          // Compare timestamps directly. No need to modify the date objects.
          if (dueDate.getTime() === today.getTime()) {
            todayItems.push({
              id: p['Pipeline No.'], type: 'project', title: p['Company Name'], subtitle: p.Require || 'Pipeline Requirement',
              date: dueDate, link: { view: 'projects', filter: p['Pipeline No.'] }, icon: <Briefcase className="w-5 h-5 text-indigo-600" />
            });
          } else if (dueDate.getTime() > today.getTime() && dueDate.getTime() < endOfUpcoming.getTime()) {
            upcomingItems.push({
              id: p['Pipeline No.'], type: 'project', title: p['Company Name'], subtitle: p.Require || 'Pipeline Requirement',
              date: dueDate, link: { view: 'projects', filter: p['Pipeline No.'] }, icon: <Briefcase className="w-5 h-5 text-indigo-600" />
            });
          }
        }
      });
    }

    if (meetings) {
      meetings.forEach(m => {
        if (m['Responsible By'] !== currentUser?.Name) return;

        if ((m.Status === 'Open' || m.Status === 'Pending') && m['Meeting ID']) {
          // parseDate returns a Date object at midnight UTC+7. Use it directly.
          const meetingDate = parseDate(m['Meeting Date']);
          if (meetingDate) {
            if (meetingDate.getTime() === today.getTime()) {
              todayItems.push({
                id: m['Meeting ID'], type: 'meeting', title: m['Company Name'], subtitle: `With ${m.Participants}`,
                date: meetingDate, time: m['Start Time'], link: { view: 'meetings', filter: m['Meeting ID'] }, icon: <Calendar className="w-5 h-5 text-sky-600" />
              });
            } else if (meetingDate.getTime() > today.getTime() && meetingDate.getTime() < endOfUpcoming.getTime()) {
              upcomingItems.push({
                id: m['Meeting ID'], type: 'meeting', title: m['Company Name'], subtitle: `With ${m.Participants}`,
                date: meetingDate, time: m['Start Time'], link: { view: 'meetings', filter: m['Meeting ID'] }, icon: <Calendar className="w-5 h-5 text-sky-600" />
              });
            }
          }
        }
      });
    }

    const sortByDate = (a: PendingWorkItem, b: PendingWorkItem) => a.date.getTime() - b.date.getTime();
    todayItems.sort(sortByDate);
    upcomingItems.sort(sortByDate);

    return { todayItems, upcomingItems };
  }, [processedFilteredProjects, meetings, currentUser]);

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

      const dateStr = isB2B ? (item['Inv Date'] || item['Created Date']) : item['SO Date'];
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
      const amountVal = isB2B ? item['Bid Value'] : item['Total Amount'];
      const totalAmount = parseSheetValue(amountVal);
      const dateStr = isB2B ? (item['Inv Date'] || item['Created Date']) : item['SO Date'];

      // Calculate subtotal by subtracting VAT from total
      let subtotal = totalAmount;
      if (isB2B) {
        // B2B: Use 'Taxable' field
        if (item.Taxable === 'VAT' && totalAmount > 0) {
          subtotal = totalAmount / 1.1;
        }
      } else {
        // B2C: Use 'Tax' field or 'Bill Invoice'
        const taxAmount = parseSheetValue(item['Tax']);
        if (taxAmount > 0) {
          subtotal = totalAmount - taxAmount;
        } else if (item['Bill Invoice'] === 'VAT' && totalAmount > 0) {
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

  const topCustomersData = useMemo(() => {
    const baseData = filteredProjects;
    if (!baseData) return [];

    const wonProjects = baseData.filter(p => {
      if (p.Status !== 'Close (win)') return false;
      if (currencyFilter === 'USD') return p.Currency !== 'KHR';
      return p.Currency === currencyFilter;
    });

    const customerValues = wonProjects.reduce((acc, project) => {
      const customer = project['Company Name'];
      const bidValue = parseSheetValue(project['Bid Value']);
      if (customer && bidValue > 0) {
        if (!acc[customer]) {
          acc[customer] = { winValue: 0, projectCount: 0 };
        }
        acc[customer].winValue += bidValue;
        acc[customer].projectCount += 1;
      }
      return acc;
    }, {} as { [key: string]: { winValue: number, projectCount: number } });

    return Object.entries(customerValues)
      .map(([name, value]: [string, { winValue: number, projectCount: number }]) => ({ name, winValue: value.winValue, projectCount: value.projectCount }))
      .sort((a, b) => b.winValue - a.winValue)
      .slice(0, 10);
  }, [projects, filteredProjects, filters.companyName, currencyFilter]);

  const projectsByBrandData = useMemo(() => {
    const baseData = filteredProjects;
    if (!baseData) return [];

    const brandCounts = baseData.reduce((acc, project) => {
      const brand = project['Brand 1'];
      if (brand && brand.trim() !== '' && brand.trim() !== 'N/A') {
        if (!acc[brand]) {
          acc[brand] = { count: 0, totalValue: 0 };
        }
        acc[brand].count += 1;
        acc[brand].totalValue += parseSheetValue(project['Bid Value']);
      }
      return acc;
    }, {} as { [key: string]: { count: number; totalValue: number } });

    return Object.entries(brandCounts)
      .map(([name, value]: [string, { count: number, totalValue: number }]) => ({ name, count: value.count, totalValue: value.totalValue }))
      .sort((a, b) => b.count - a.count);
  }, [projects, filteredProjects, filters.brand1]);


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
    <div className="space-y-6 p-4 md:p-0">
      {renderStep >= 1 && (
        <div className={`grid ${isB2B ? 'grid-cols-2 gap-4 md:gap-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6'} ${transitionClass(1)}`}>
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

      {/* Show Revenue Chart in both modes, but logic differs inside */}
      {renderStep >= 3 && (
        <div className={`${transitionClass(3)} h-[400px] lg:h-[480px] min-w-0`}>
          <MonthlyWinValueChart
            data={revenueByPeriodData.chartData}
            period={revenuePeriod}
            onPeriodChange={setRevenuePeriod}
            currency={currencyFilter}
            isB2B={isB2B}
          />
        </div>
      )}

      <div className={`grid grid-cols-1 ${isB2B ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-6`}>
        {/* Hide Win Rate Chart in B2B mode */}
        {!isB2B && renderStep >= 4 && (
          <div className={`${transitionClass(4)} min-h-[400px] min-w-0`}>
            <WinRateChart winRate={winRateData.winRate} won={winRateData.won} total={winRateData.total} />
          </div>
        )}
        {/* Hide Pending Works in B2B mode */}
        {!isB2B && renderStep >= 5 && (
          <div className={`${transitionClass(5)} min-h-[400px] min-w-0`}>
            <PendingWorks todayItems={pendingWorks.todayItems} upcomingItems={pendingWorks.upcomingItems} />
          </div>
        )}
        {/* Keep Project Outcome Chart in both modes */}
        {renderStep >= 6 && (
          <div className={`${transitionClass(6)} min-h-[400px] min-w-0`}>
            <ProjectOutcomeChart data={projectOutcomeData} />
          </div>
        )}
      </div>

      {/* Show Top Customers and Projects by Brand charts in both modes */}
      <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-3'} gap-6`}>
        {renderStep >= 7 && (
          <div className={`${isMobile ? '' : 'lg:col-span-2'} ${transitionClass(7)} h-[400px] lg:h-[480px] min-w-0`}>
            <TopCustomersChart data={topCustomersData} totalWinValue={totalWinValue} currency={currencyFilter} />
          </div>
        )}
        {renderStep >= 8 && (
          <div className={`${isMobile ? '' : 'lg:col-span-1'} ${transitionClass(8)} h-[400px] lg:h-[480px] min-w-0`}>
            <ProjectsByBrandChart data={projectsByBrandData} />
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