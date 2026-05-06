import React from 'react'
import {
  AccessTime as AccessTimeIcon,
  Add as AddIcon,
  AutoAwesome as AutoAwesomeIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Autorenew as AutorenewIcon,
  Bed as BedMuiIcon,
  CalendarMonth as CalendarMonthIcon,
  CheckCircle as CheckCircleMuiIcon,
  Checklist as ChecklistIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  CurrencyRupee as CurrencyRupeeIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  Download as DownloadMuiIcon,
  Engineering as EngineeringIcon,
  ExpandLess as ExpandLessIcon,
  Print as PrintIcon,
  ExpandMore as ExpandMoreIcon,
  Home as HomeMuiIcon,
  Lock as LockMuiIcon,
  LockOpen as LockOpenMuiIcon,
  MedicalServices as MedicalServicesIcon,
  Medication as MedicationIcon,
  MonitorHeart as MonitorHeartIcon,
  PersonAdd as PersonAddIcon,
  Person as PersonIcon,
  Search as SearchMuiIcon,
  Send as SendMuiIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Store as StoreMuiIcon,
  ToggleOff as ToggleOffIcon,
  ToggleOn as ToggleOnIcon,
  TrendingDown as TrendingDownMuiIcon,
  TrendingUp as TrendingUpMuiIcon,
  Groups as GroupsIcon,
  Folder as FolderIcon,
  Science as ScienceIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  WarningAmber as WarningAmberIcon,
  Inventory2 as Inventory2Icon,
  Waves as WavesIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
} from '@mui/icons-material'

function asLucide(Icon) {
  return function LucideCompat({ size, className, sx, ...rest }) {
    return <Icon className={className} sx={{ ...(size ? { fontSize: size } : {}), ...sx }} {...rest} />
  }
}

export const Calendar = asLucide(CalendarMonthIcon)
export const Eye = asLucide(VisibilityIcon)
export const Loader2 = asLucide(AutorenewIcon)
export const Pencil = asLucide(EditIcon)
export const RefreshCw = asLucide(AutorenewIcon)
export const SearchIconCompat = asLucide(SearchMuiIcon)
export const Search = SearchIconCompat
export const Plus = asLucide(AddIcon)
export const X = asLucide(CloseIcon)
export const Clock3 = asLucide(AccessTimeIcon)
export const Stethoscope = asLucide(MedicalServicesIcon)
export const UserRound = asLucide(PersonIcon)
export const TrendingUp = asLucide(TrendingUpMuiIcon)
export const Users = asLucide(GroupsIcon)
export const DollarSign = asLucide(CurrencyRupeeIcon)
export const Activity = asLucide(MonitorHeartIcon)
export const Pill = asLucide(MedicationIcon)
export const Trash2 = asLucide(DeleteIcon)
export const ArrowLeft = asLucide(ArrowBackIcon)
export const Package = asLucide(Inventory2Icon)
export const Folder = asLucide(FolderIcon)
export const CheckCircle2 = asLucide(CheckCircleMuiIcon)
export const CheckCircleIconCompat = asLucide(CheckCircleMuiIcon)
export const CheckCircle = CheckCircleIconCompat
export const StoreIconCompat = asLucide(StoreMuiIcon)
export const Store = StoreIconCompat
export const ArrowRight = asLucide(ArrowForwardIcon)
export const DownloadIconCompat = asLucide(DownloadMuiIcon)
export const Download = DownloadIconCompat
export const FileText = asLucide(DescriptionIcon)
export const AlertTriangle = asLucide(WarningAmberIcon)
export const Receipt = asLucide(DescriptionIcon)
export const Clock = asLucide(AccessTimeIcon)
export const Printer = asLucide(PrintIcon)
export const Beaker = asLucide(ScienceIcon)
export const ChevronDown = asLucide(ExpandMoreIcon)
export const ChevronUp = asLucide(ExpandLessIcon)
export const ChevronRight = asLucide(ChevronRightIcon)
export const Wind = asLucide(WavesIcon)
export const Fan = asLucide(SettingsIcon)
export const Bed = asLucide(BedMuiIcon)
export const Wrench = asLucide(EngineeringIcon)
export const Sparkles = asLucide(AutoAwesomeIcon)
export const Shield = asLucide(SecurityIcon)
export const Home = asLucide(HomeMuiIcon)
export const ClipboardList = asLucide(ChecklistIcon)
export const Lock = asLucide(LockMuiIcon)
export const LockOpen = asLucide(LockOpenMuiIcon)
export const PenLine = asLucide(EditIcon)
export const Send = asLucide(SendMuiIcon)
export const UserPlus = asLucide(PersonAddIcon)
export const TrendingDown = asLucide(TrendingDownMuiIcon)
export const Wallet = asLucide(AccountBalanceWalletIcon)
export const IndianRupee = asLucide(CurrencyRupeeIcon)
export const ToggleLeft = asLucide(ToggleOffIcon)
export const ToggleRight = asLucide(ToggleOnIcon)
export const AlertCircle = asLucide(WarningAmberIcon)
export const User = asLucide(PersonIcon)

