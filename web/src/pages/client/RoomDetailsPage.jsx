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
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

const AMENITY_MAP = {
  wifi: { label: "WiFi", icon: Wifi },
  kitchen: { label: "Kitchen" },
  bathroom: { label: "Bathroom" },
  bedroom: { label: "Bedroom" },
  hotwater: { label: "Hot Water" },
  parking: { label: "Parking" },
  aircon: { label: "Air-con" },
  laundry: { label: "Laundry" },
  tv: { label: "TV" },
  cctv: { label: "CCTV" },
  common: { label: "Common Area" },
  gym: { label: "Gym" },
};

export default function RoomDetailsPage() {
  const { state } = useAuth();
  const { user } = state;
  const userId = user?.id || user?._id;
  const navigate = useNavigate();
  const { id: roomIdParam } = useParams();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    if (userId) load();
  }, [userId, roomIdParam]);

  const load = async () => {
    setLoading(true);
    try {
      if (roomIdParam) {
        // Viewing a specific room by id (e.g. available room before joining)
        const fullRes = await roomService.getRoomById(roomIdParam);
        setRoom(fullRes?.room || fullRes?.data || fullRes);
      } else {
        // Viewing the user's own joined room
        const roomsRes = await roomService.getClientRooms();
        const rooms = Array.isArray(roomsRes)
          ? roomsRes
          : roomsRes?.rooms || [];
        const joined = rooms[0] || null;
        if (joined) {
          const fullRes = await roomService.getRoomById(
            joined.id || joined._id,
          );
          setRoom(fullRes?.room || fullRes?.data || fullRes || joined);
        }
      }
    } catch (_) {}
    setLoading(false);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-accent" />
      </div>
    );

  if (!room)
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-accent"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <EmptyState
          icon="🏠"
          title="No room found"
          subtitle="You haven't joined a room yet"
        />
      </div>
    );

  const photos = Array.isArray(room.photos) ? room.photos : [];
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];
  const houseRules = Array.isArray(room.houseRules)
    ? room.houseRules
    : room.house_rules || [];
  const members = room.members || [];
  const billing = room.billing || {};

  // Only show billing details to members of the room
  const isMember = members.some(
    (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-accent"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {room.name}
          </h1>
          {room.code && (
            <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
              Code:{" "}
              <span className="font-mono font-bold text-accent">
                {room.code}
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-white/40">
          <Users size={14} />
          <span>{members.length}</span>
        </div>
      </div>

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="card overflow-hidden">
          <div className="relative w-full h-52 bg-gray-100 dark:bg-white/5">
            <img
              src={
                typeof photos[photoIdx] === "string"
                  ? photos[photoIdx]
                  : photos[photoIdx]?.url
              }
              alt={`Room photo ${photoIdx + 1}`}
              className="w-full h-full object-cover"
            />
            {photos.length > 1 && (
              <div className="absolute bottom-3 right-3 flex gap-1">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIdx(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === photoIdx ? "bg-white" : "bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {room.description && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">
            About
          </h2>
          <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed">
            {room.description}
          </p>
        </div>
      )}

      {/* Address / location */}
      {(room.address || room.latitude) && (
        <div className="card p-4 flex items-start gap-3">
          <MapPin size={16} className="text-accent mt-0.5 shrink-0" />
          <div>
            {room.address && (
              <p className="text-sm text-gray-700 dark:text-white/70">
                {room.address}
              </p>
            )}
            {room.latitude && room.longitude && (
              <a
                href={`https://maps.google.com/?q=${room.latitude},${room.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
              >
                View on map
              </a>
            )}
          </div>
        </div>
      )}

      {/* Amenities */}
      {amenities.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
            Amenities
          </h2>
          <div className="flex flex-wrap gap-2">
            {amenities.map((key) => {
              const meta = AMENITY_MAP[key] || { label: key };
              const Icon = meta.icon;
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 rounded-full text-xs font-medium text-accent"
                >
                  {Icon && <Icon size={12} />}
                  {meta.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* House rules */}
      {houseRules.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
            House Rules
          </h2>
          <ul className="space-y-2">
            {houseRules.map((rule, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-700 dark:text-white/70"
              >
                <span className="text-accent font-bold mt-0.5 shrink-0">•</span>
                {rule}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Billing info — only visible to room members */}
      {isMember &&
        (billing.rent ||
          billing.electricity ||
          billing.water ||
          billing.internet) && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
              Billing Info
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Number(billing.rent) > 0 && (
                <div className="flex items-center gap-2">
                  <Home size={14} className="text-orange-500 shrink-0" />
                  <div>
                    <p className="text-gray-500 dark:text-white/40 text-xs">
                      Rent
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      ₱{Number(billing.rent).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {Number(billing.electricity) > 0 && (
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-amber-500 shrink-0" />
                  <div>
                    <p className="text-gray-500 dark:text-white/40 text-xs">
                      Electricity
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      ₱{Number(billing.electricity).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {Number(billing.water) > 0 && (
                <div className="flex items-center gap-2">
                  <Droplets size={14} className="text-blue-500 shrink-0" />
                  <div>
                    <p className="text-gray-500 dark:text-white/40 text-xs">
                      Water
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {room.waterBillingMode === "fixed_monthly"
                        ? `₱${Number(room.waterFixedAmount || billing.water).toLocaleString()} (fixed)`
                        : "₱5/day (presence-based)"}
                    </p>
                  </div>
                </div>
              )}
              {Number(billing.internet) > 0 && (
                <div className="flex items-center gap-2">
                  <Wifi size={14} className="text-purple-500 shrink-0" />
                  <div>
                    <p className="text-gray-500 dark:text-white/40 text-xs">
                      Internet
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      ₱{Number(billing.internet).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Members */}
      {members.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
            Members ({members.length})
          </h2>
          <div className="space-y-3">
            {members.map((m, i) => {
              const memberUser = m.user || {};
              const name = memberUser.name || memberUser.email || "Member";
              const avSrc = (() => {
                const a = memberUser.avatar;
                if (!a) return null;
                if (typeof a === "string")
                  return a.startsWith("{") ? JSON.parse(a)?.url : a;
                return a?.url;
              })();
              const isMe =
                String(memberUser.id || memberUser._id) === String(userId);
              return (
                <div key={i} className="flex items-center gap-3">
                  <Avatar src={avSrc} name={name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {name}
                      {isMe && (
                        <span className="ml-1 text-xs text-accent">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-white/30">
                      {m.status || "active"}
                    </p>
                  </div>
                  {(m.isPayer || m.is_payer) && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                      <Star size={10} fill="currentColor" /> Payer
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
