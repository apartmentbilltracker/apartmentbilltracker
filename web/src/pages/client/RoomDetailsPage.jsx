import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { roomService } from "../../services/apiService";
import { Spinner, EmptyState, Avatar } from "../../components/ui";
import {
  Home,
  Wifi,
  ChevronLeft,
  MapPin,
  Users,
  Zap,
  Droplets,
  Star,
  Activity,
  Compass,
  FileText,
  ChefHat,
  Bath,
  Bed,
  Thermometer,
  Car,
  Wind,
  Tv,
  Shield,
  Dumbbell,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

/* Friendly, clear amenity labels */
const AMENITY_MAP = {
  wifi: { label: "High-Speed WiFi", icon: Wifi },
  kitchen: { label: "Shared Kitchen", icon: ChefHat },
  bathroom: { label: "Modern Bathroom", icon: Bath },
  bedroom: { label: "Private Bedroom", icon: Bed },
  hotwater: { label: "Hot Water System", icon: Thermometer },
  parking: { label: "Secure Parking", icon: Car },
  aircon: { label: "Air Conditioning", icon: Wind },
  laundry: { label: "Laundry Facilities", icon: Sparkles },
  tv: { label: "Smart TV", icon: Tv },
  cctv: { label: "24/7 Security CCTV", icon: Shield },
  common: { label: "Common Lounge Area", icon: Compass },
  gym: { label: "Fitness Gym", icon: Dumbbell },
};

export default function RoomDetailsPage() {
  const { state } = useAuth(); //[cite: 10]
  const { user } = state; //[cite: 10]
  const userId = user?.id || user?._id; //[cite: 10]
  const navigate = useNavigate(); //[cite: 10]
  const { id: roomIdParam } = useParams(); //[cite: 10]

  const [room, setRoom] = useState(null); //[cite: 10]
  const [loading, setLoading] = useState(true); //[cite: 10]
  const [photoIdx, setPhotoIdx] = useState(0); //[cite: 10]

  useEffect(() => {
    if (userId) load(); //[cite: 10]
  }, [userId, roomIdParam]); //[cite: 10]

  const load = async () => {
    setLoading(true); //[cite: 10]
    try {
      if (roomIdParam) {
        //[cite: 10]
        const fullRes = await roomService.getRoomById(roomIdParam); //[cite: 10]
        setRoom(fullRes?.room || fullRes?.data || fullRes); //[cite: 10]
      } else {
        const roomsRes = await roomService.getClientRooms(); //[cite: 10]
        const rooms = Array.isArray(roomsRes)
          ? roomsRes
          : roomsRes?.rooms || []; //[cite: 10]
        const joined = rooms[0] || null; //[cite: 10]
        if (joined) {
          const fullRes = await roomService.getRoomById(
            joined.id || joined._id, //[cite: 10]
          );
          setRoom(fullRes?.room || fullRes?.data || fullRes || joined); //[cite: 10]
        }
      }
    } catch (_) {}
    setLoading(false); //[cite: 10]
  };

  /* Warm, welcoming loading state */
  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-48 space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-16 h-16 rounded-2xl bg-[#1a7a52]/20 dark:bg-[#7ee8a2]/10 animate-ping duration-1000" />
          <div className="w-12 h-12 rounded-2xl border-2 border-slate-200 dark:border-slate-800 border-t-[#1a7a52] dark:border-t-[#7ee8a2] animate-spin" />
          <div className="absolute w-5 h-5 rounded-xl bg-gradient-to-br from-[#1a7a52] to-[#135c3d] dark:from-[#7ee8a2] dark:to-[#64d08b] shadow-md flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#02302e] animate-pulse" />
          </div>
        </div>
        <p className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase animate-pulse pt-2">
          Opening room details...
        </p>
      </div>
    );

  if (!room)
    return (
      <div className="space-y-6 max-w-5xl mx-auto px-4 animate-fadeIn">
        <button
          onClick={() => navigate(-1)} //[cite: 10]
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-[#1a7a52] dark:hover:text-[#7ee8a2] transition-colors"
        >
          <ChevronLeft size={14} /> Back
        </button>
        <EmptyState
          icon="🏠" //[cite: 10]
          title="No room found"
          subtitle="It looks like you haven't joined a room or community space yet." //[cite: 10]
        />
      </div>
    );

  const photos = Array.isArray(room.photos) ? room.photos : []; //[cite: 10]
  const amenities = Array.isArray(room.amenities) ? room.amenities : []; //[cite: 10]
  const houseRules = Array.isArray(room.houseRules) //[cite: 10]
    ? room.houseRules //[cite: 10]
    : room.house_rules || []; //[cite: 10]
  const members = room.members || []; //[cite: 10]
  const billing = room.billing || {}; //[cite: 10]

  const isMember = members.some(
    (m) => String(m.user?.id || m.user?._id || m.user) === String(userId), //[cite: 10]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 space-y-6 pb-16 animate-fadeIn">
      {/* Header Container */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/80 p-5 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group shrink-0">
        <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 blur-3xl group-hover:scale-110 transition-transform duration-700" />

        <div className="flex items-center gap-4 z-10">
          <button
            onClick={() => navigate(-1)} //[cite: 10]
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all transform active:scale-95"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="space-y-0.5">
            <div className="flex items-center flex-wrap gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                {room.name} {/*[cite: 10] */}
              </h1>
              {room.code && ( //[cite: 10]
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 text-[10px] font-bold uppercase tracking-wide text-[#1a7a52] dark:text-[#7ee8a2]">
                  Room Code: <span className="font-mono ml-1">{room.code}</span>{" "}
                  {/*[cite: 10] */}
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Co-living Room Details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          <Users size={13} className="text-[#1a7a52] dark:text-[#7ee8a2]" />
          <span>{members.length} Roommates</span> {/*[cite: 10] */}
        </div>
      </div>

      {/* Main Structural Bento Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column Pane (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo Gallery */}
          {photos.length > 0 && ( //[cite: 10]
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-sm relative group">
              <div className="relative w-full h-64 sm:h-80 md:h-96">
                <img
                  src={
                    typeof photos[photoIdx] === "string" //[cite: 10]
                      ? photos[photoIdx] //[cite: 10]
                      : photos[photoIdx]?.url //[cite: 10]
                  }
                  alt={`Room view ${photoIdx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                />

                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

                {photos.length > 1 && ( //[cite: 10]
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10 bg-black/20 backdrop-blur-md px-2.5 py-1.5 rounded-full">
                    {photos.map(
                      (
                        _,
                        i, //[cite: 10]
                      ) => (
                        <button
                          key={i}
                          onClick={() => setPhotoIdx(i)} //[cite: 10]
                          className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            i === photoIdx
                              ? "bg-white scale-125 shadow-sm"
                              : "bg-white/40 hover:bg-white/70" //[cite: 10]
                          }`}
                        />
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description Section */}
          {room.description && ( //[cite: 10]
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 bg-white dark:bg-slate-900 shadow-sm space-y-3">
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                <Compass size={14} /> About this space
              </h2>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                {room.description} {/*[cite: 10] */}
              </p>
            </div>
          )}

          {/* Amenities Grid */}
          {amenities.length > 0 && ( //[cite: 10]
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                <Activity size={14} /> What this room offers
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {amenities.map((key) => {
                  //[cite: 10]
                  const meta = AMENITY_MAP[key] || { label: key, icon: Home }; //[cite: 10]
                  const Icon = meta.icon;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs font-semibold text-slate-700 dark:text-slate-300 group/item hover:border-[#1a7a52]/30 dark:hover:border-[#7ee8a2]/20 transition-all"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/40 dark:border-slate-700/60 flex items-center justify-center text-slate-400 group-hover/item:text-[#1a7a52] dark:group-hover/item:text-[#7ee8a2] transition-colors shrink-0 shadow-2xs">
                        {Icon && <Icon size={14} />}
                      </div>
                      <span className="truncate">{meta.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* House Rules */}
          {houseRules.length > 0 && ( //[cite: 10]
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                <FileText size={14} /> House Rules & Guidelines
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {houseRules.map(
                  (
                    rule,
                    i, //[cite: 10]
                  ) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl border border-dashed border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed"
                    >
                      <span className="w-5 h-5 rounded-md bg-[#1a7a52]/10 dark:bg-[#7ee8a2]/10 text-[#1a7a52] dark:text-[#7ee8a2] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="flex-1">{rule}</span> {/*[cite: 10] */}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column Pane (1/3 width) */}
        <div className="space-y-6">
          {/* Location Details */}
          {(room.address || room.latitude) && ( //[cite: 10]
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 bg-white dark:bg-slate-900 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                <MapPin size={14} /> Location
              </h3>
              <div className="space-y-3">
                {room.address && ( //[cite: 10]
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                    {room.address} {/*[cite: 10] */}
                  </p>
                )}
                {room.latitude &&
                  room.longitude && ( //[cite: 10]
                    <a
                      href={`https://maps.google.com/?q=${room.latitude},${room.longitude}`} //[cite: 10]
                      target="_blank" //[cite: 10]
                      rel="noopener noreferrer" //[cite: 10]
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1a7a52] dark:text-[#7ee8a2] hover:underline"
                    >
                      <span>View on Google Maps</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
              </div>
            </div>
          )}

          {/* Billing Info Panel */}
          {isMember && //[cite: 10]
            (billing.rent || //[cite: 10]
              billing.electricity || //[cite: 10]
              billing.water || //[cite: 10]
              billing.internet) && ( //[cite: 10]
              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                  <Activity size={14} /> Shared Bills & Expenses
                </h3>
                <div className="space-y-3">
                  {Number(billing.rent) > 0 && ( //[cite: 10]
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                          <Home size={14} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Rent
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        ₱{Number(billing.rent).toLocaleString()}{" "}
                        {/*[cite: 10] */}
                      </p>
                    </div>
                  )}

                  {Number(billing.electricity) > 0 && ( //[cite: 10]
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Zap size={14} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Electricity
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        ₱{Number(billing.electricity).toLocaleString()}{" "}
                        {/*[cite: 10] */}
                      </p>
                    </div>
                  )}

                  {Number(billing.water) > 0 && ( //[cite: 10]
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Droplets size={14} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Water
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {room.waterBillingMode === "fixed_monthly" //[cite: 10]
                            ? `₱${Number(room.waterFixedAmount || billing.water).toLocaleString()}` //[cite: 10]
                            : "₱5 / day"}{" "}
                          {/*[cite: 10] */}
                        </p>
                        <p className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">
                          {room.waterBillingMode === "fixed_monthly"
                            ? "Fixed Monthly"
                            : "Daily Rate"}{" "}
                          {/*[cite: 10] */}
                        </p>
                      </div>
                    </div>
                  )}

                  {Number(billing.internet) > 0 && ( //[cite: 10]
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                          <Wifi size={14} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Internet
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        ₱{Number(billing.internet).toLocaleString()}{" "}
                        {/*[cite: 10] */}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Members List */}
          {members.length > 0 && ( //[cite: 10]
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                <Users size={14} /> Meet your roommates
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {members.map((m, i) => {
                  //[cite: 10]
                  const memberUser = m.user || {}; //[cite: 10]
                  const name =
                    memberUser.name || memberUser.email || "Roommate"; //[cite: 10]
                  const avSrc = (() => {
                    const a = memberUser.avatar; //[cite: 10]
                    if (!a) return null; //[cite: 10]
                    if (typeof a === "string")
                      return a.startsWith("{") ? JSON.parse(a)?.url : a; //[cite: 10]
                    return a?.url; //[cite: 10]
                  })();
                  const isMe =
                    String(memberUser.id || memberUser._id) === String(userId); //[cite: 10]

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 ring-2 ring-slate-100 dark:ring-slate-800 rounded-full">
                          <Avatar src={avSrc} name={name} size="sm" />{" "}
                          {/*[cite: 10] */}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
                            {name} {/*[cite: 10] */}
                            {isMe && ( //[cite: 10]
                              <span className="text-[9px] font-bold tracking-wide text-[#1a7a52] dark:text-[#7ee8a2] uppercase bg-[#1a7a52]/5 dark:bg-[#7ee8a2]/5 px-1 rounded">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                            {m.status || "Active"} {/*[cite: 10] */}
                          </p>
                        </div>
                      </div>

                      {(m.isPayer || m.is_payer) && ( //[cite: 10]
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20 px-2 py-0.5 rounded-md shrink-0 border border-amber-500/10">
                          <Star size={9} fill="currentColor" /> Primary Payer{" "}
                          {/*[cite: 10] */}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
