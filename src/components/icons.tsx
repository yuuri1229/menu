import type { ComponentType } from "react";
import type { IconBaseProps } from "react-icons";
import {
  MdOutlineAccountBalanceWallet,
  MdOutlineAccountCircle,
  MdOutlineAddBox,
  MdOutlineArrowForward,
  MdOutlineAssignment,
  MdOutlineAutoAwesome,
  MdOutlineAutorenew,
  MdOutlineCalendarMonth,
  MdOutlineCheck,
  MdOutlineCheckCircle,
  MdOutlineChevronLeft,
  MdOutlineChevronRight,
  MdOutlineClose,
  MdOutlineEdit,
  MdOutlineExpandMore,
  MdOutlineFeedback,
  MdOutlineHome,
  MdOutlineInfo,
  MdOutlineIosShare,
  MdOutlineKitchen,
  MdOutlineLightbulb,
  MdOutlineLock,
  MdOutlineLogout,
  MdOutlineMail,
  MdOutlineMenuBook,
  MdOutlineNotifications,
  MdOutlineNotificationsOff,
  MdOutlineReceipt,
  MdOutlineReceiptLong,
  MdOutlineRefresh,
  MdOutlineRemove,
  MdOutlineRestaurantMenu,
  MdOutlineSchedule,
  MdOutlineSearch,
  MdOutlineSetMeal,
  MdOutlineShoppingBasket,
  MdOutlineStickyNote2,
  MdOutlineStorefront,
  MdOutlineAcUnit,
  MdOutlineThumbDown,
  MdOutlineThumbUp,
  MdOutlineVisibility,
  MdOutlineVisibilityOff,
  MdOutlineWarningAmber,
  MdOutlineDescription,
  MdOutlineLunchDining,
} from "react-icons/md";

/**
 * 画面内のアイコンはすべてマテリアルデザインのアイコン（Outlined）にそろえる。絵文字は使わない。
 * 呼び出し側は className で大きさと色を決める。strokeWidth は線のアイコン時代の名残なので受け取って捨てる。
 */
export type IconProps = Omit<IconBaseProps, "strokeWidth"> & { strokeWidth?: number | string };
export type AppIcon = ComponentType<IconProps>;

function material(Base: ComponentType<IconBaseProps>, name: string): AppIcon {
  const Icon = ({ strokeWidth: _ignored, ...props }: IconProps) => <Base aria-hidden={props["aria-label"] ? undefined : true} {...props} />;
  Icon.displayName = name;
  return Icon;
}

export const ArrowRight = material(MdOutlineArrowForward, "ArrowRight");
export const Bell = material(MdOutlineNotifications, "Bell");
export const BellOff = material(MdOutlineNotificationsOff, "BellOff");
export const BookOpen = material(MdOutlineMenuBook, "BookOpen");
export const CalendarDays = material(MdOutlineCalendarMonth, "CalendarDays");
export const Check = material(MdOutlineCheck, "Check");
export const ChefHat = material(MdOutlineRestaurantMenu, "ChefHat");
export const ChevronDown = material(MdOutlineExpandMore, "ChevronDown");
export const ChevronLeft = material(MdOutlineChevronLeft, "ChevronLeft");
export const ChevronRight = material(MdOutlineChevronRight, "ChevronRight");
export const CircleCheck = material(MdOutlineCheckCircle, "CircleCheck");
export const CircleUserRound = material(MdOutlineAccountCircle, "CircleUserRound");
export const ClipboardList = material(MdOutlineAssignment, "ClipboardList");
export const Clock = material(MdOutlineSchedule, "Clock");
export const Eye = material(MdOutlineVisibility, "Eye");
export const EyeOff = material(MdOutlineVisibilityOff, "EyeOff");
export const Fish = material(MdOutlineSetMeal, "Fish");
export const House = material(MdOutlineHome, "House");
export const Info = material(MdOutlineInfo, "Info");
export const Lightbulb = material(MdOutlineLightbulb, "Lightbulb");
export const LoaderCircle = material(MdOutlineAutorenew, "LoaderCircle");
export const Lock = material(MdOutlineLock, "Lock");
export const LogOut = material(MdOutlineLogout, "LogOut");
export const Mail = material(MdOutlineMail, "Mail");
export const MessageCircleHeart = material(MdOutlineFeedback, "MessageCircleHeart");
export const Minus = material(MdOutlineRemove, "Minus");
export const NotebookText = material(MdOutlineDescription, "NotebookText");
export const Pencil = material(MdOutlineEdit, "Pencil");
export const Receipt = material(MdOutlineReceipt, "Receipt");
export const ReceiptText = material(MdOutlineReceiptLong, "ReceiptText");
export const RefreshCw = material(MdOutlineRefresh, "RefreshCw");
export const Refrigerator = material(MdOutlineKitchen, "Refrigerator");
export const Search = material(MdOutlineSearch, "Search");
export const Share = material(MdOutlineIosShare, "Share");
export const ShoppingBasket = material(MdOutlineShoppingBasket, "ShoppingBasket");
export const Snowflake = material(MdOutlineAcUnit, "Snowflake");
export const Sparkles = material(MdOutlineAutoAwesome, "Sparkles");
export const SquarePlus = material(MdOutlineAddBox, "SquarePlus");
export const StickyNote = material(MdOutlineStickyNote2, "StickyNote");
export const Store = material(MdOutlineStorefront, "Store");
export const ThumbsDown = material(MdOutlineThumbDown, "ThumbsDown");
export const ThumbsUp = material(MdOutlineThumbUp, "ThumbsUp");
export const TriangleAlert = material(MdOutlineWarningAmber, "TriangleAlert");
export const Wallet = material(MdOutlineAccountBalanceWallet, "Wallet");
export const X = material(MdOutlineClose, "X");
export const Bento = material(MdOutlineLunchDining, "Bento");

