import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { useGoogleSheetData } from '../hooks/useGoogleSheetData';
import { 
    PipelineProject, 
    Company, 
    Contact, 
    ContactLog, 
    SiteSurveyLog, 
    Meeting,
    User,
    Quotation,
    SaleOrder
} from '../types';
import { 
    PIPELINE_HEADERS, 
    COMPANY_HEADERS, 
    CONTACT_HEADERS, 
    CONTACT_LOG_HEADERS, 
    SITE_SURVEY_LOG_HEADERS, 
    MEETING_HEADERS,
    USER_HEADERS,
    QUOTATION_HEADERS,
    SALE_ORDER_HEADERS
} from '../schemas';

interface DataContextProps {
  projects: PipelineProject[] | null;
  setProjects: React.Dispatch<React.SetStateAction<PipelineProject[] | null>>;
  companies: Company[] | null;
  setCompanies: React.Dispatch<React.SetStateAction<Company[] | null>>;
  contacts: Contact[] | null;
  setContacts: React.Dispatch<React.SetStateAction<Contact[] | null>>;
  contactLogs: ContactLog[] | null;
  setContactLogs: React.Dispatch<React.SetStateAction<ContactLog[] | null>>;
  siteSurveys: SiteSurveyLog[] | null;
  setSiteSurveys: React.Dispatch<React.SetStateAction<SiteSurveyLog[] | null>>;
  meetings: Meeting[] | null;
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[] | null>>;
  users: User[] | null;
  setUsers: React.Dispatch<React.SetStateAction<User[] | null>>;
  quotations: Quotation[] | null;
  setQuotations: React.Dispatch<React.SetStateAction<Quotation[] | null>>;
  saleOrders: SaleOrder[] | null;
  setSaleOrders: React.Dispatch<React.SetStateAction<SaleOrder[] | null>>;
  loading: boolean;
  error: string | null;
  activeCompanyNames: Set<string>;
  activeContactNames: Set<string>;
  activePipelineIds: Set<string>;
  refetchData: () => void;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refetchCounter, setRefetchCounter] = useState(0);

  const [projects, setProjects] = useState<PipelineProject[] | null>(null);
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [contactLogs, setContactLogs] = useState<ContactLog[] | null>(null);
  const [siteSurveys, setSiteSurveys] = useState<SiteSurveyLog[] | null>(null);
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [quotations, setQuotations] = useState<Quotation[] | null>(null);
  const [saleOrders, setSaleOrders] = useState<SaleOrder[] | null>(null);

  const refetchData = useCallback(() => {
    setRefetchCounter(c => c + 1);
  }, []);

  const { data: fetchedProjects, loading: projectsLoading, error: projectsError } = useGoogleSheetData<PipelineProject>('Pipelines', PIPELINE_HEADERS, refetchCounter);
  const { data: fetchedCompanies, loading: companiesLoading, error: companiesError } = useGoogleSheetData<Company>('Company List', COMPANY_HEADERS, refetchCounter);
  const { data: fetchedContacts, loading: contactsLoading, error: contactsError } = useGoogleSheetData<Contact>('Contact_List', CONTACT_HEADERS, refetchCounter);
  const { data: fetchedContactLogs, loading: contactLogsLoading, error: contactLogsError } = useGoogleSheetData<ContactLog>('Contact_Logs', CONTACT_LOG_HEADERS, refetchCounter);
  const { data: fetchedSiteSurveys, loading: siteSurveysLoading, error: siteSurveysError } = useGoogleSheetData<SiteSurveyLog>('Site_Survey_Logs', SITE_SURVEY_LOG_HEADERS, refetchCounter);
  const { data: fetchedMeetings, loading: meetingsLoading, error: meetingsError } = useGoogleSheetData<Meeting>('Meeting_Logs', MEETING_HEADERS, refetchCounter);
  const { data: fetchedUsers, loading: usersLoading, error: usersError } = useGoogleSheetData<User>('Users', USER_HEADERS, refetchCounter);
  const { data: fetchedQuotations, loading: quotationsLoading, error: quotationsError } = useGoogleSheetData<Quotation>('Quotations', QUOTATION_HEADERS, refetchCounter);
  const { data: fetchedSaleOrders, loading: saleOrdersLoading, error: saleOrdersError } = useGoogleSheetData<SaleOrder>('Sale Orders', SALE_ORDER_HEADERS, refetchCounter);

  useEffect(() => { setProjects(fetchedProjects); }, [fetchedProjects]);
  useEffect(() => { setCompanies(fetchedCompanies); }, [fetchedCompanies]);
  useEffect(() => { setContacts(fetchedContacts); }, [fetchedContacts]);
  useEffect(() => { setContactLogs(fetchedContactLogs); }, [fetchedContactLogs]);
  useEffect(() => { setSiteSurveys(fetchedSiteSurveys); }, [fetchedSiteSurveys]);
  useEffect(() => { setMeetings(fetchedMeetings); }, [fetchedMeetings]);
  useEffect(() => { setUsers(fetchedUsers); }, [fetchedUsers]);
  useEffect(() => { setQuotations(fetchedQuotations); }, [fetchedQuotations]);
  useEffect(() => { setSaleOrders(fetchedSaleOrders); }, [fetchedSaleOrders]);


  const { activeCompanyNames, activeContactNames, activePipelineIds } = useMemo(() => {
    const activeCompanyNames = new Set<string>();
    const activeContactNames = new Set<string>();
    const activePipelineIds = new Set<string>();

    if (projects) {
      projects.forEach(project => {
        if (project['Company Name']) activeCompanyNames.add(project['Company Name']);
        if (project['Contact Name']) activeContactNames.add(project['Contact Name']);
        if (project['Pipeline No.']) activePipelineIds.add(project['Pipeline No.']);
      });
    }

    return { activeCompanyNames, activeContactNames, activePipelineIds };
  }, [projects]);
  
  const loading = projectsLoading || companiesLoading || contactsLoading || contactLogsLoading || siteSurveysLoading || meetingsLoading || usersLoading || quotationsLoading || saleOrdersLoading;
  
  const error = [projectsError, companiesError, contactsError, contactLogsError, siteSurveysError, meetingsError, usersError, quotationsError, saleOrdersError]
    .filter(Boolean)
    .join('; ');

  const value = {
    projects, setProjects,
    companies, setCompanies,
    contacts, setContacts,
    contactLogs, setContactLogs,
    siteSurveys, setSiteSurveys,
    meetings, setMeetings,
    users, setUsers,
    quotations, setQuotations,
    saleOrders, setSaleOrders,
    loading,
    error: error || null,
    activeCompanyNames,
    activeContactNames,
    activePipelineIds,
    refetchData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};