--[[
    🚀 SCRIPT USER ESP (TEAMMATE DETECTOR)
    ----------------------------------------------------------
    - Chỉ hiển thị vị trí những người đang dùng script này.
    - Báo danh về server để người khác thấy mình.
]]

-- CẤU HÌNH SERVER
local SERVER_URL = "https://ten-du-an-tren-glitch.glitch.me" -- <== THAY LINK GLITCH CỦA BẠN VÀO ĐÂY
local API_HEARTBEAT = SERVER_URL .. "/api/heartbeat"

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer
local RunService = game:GetService("RunService")

-- Biến ESP
local EspCache = {} -- { [PlayerName] = {Highlight, BillboardGui} }

-- ================================================== 
-- 👁️ ESP TEAMMATE SYSTEM
-- ================================================== 

local function CreateEsp(player)
    if EspCache[player.Name] then return end
    if player == LocalPlayer then return end -- Không vẽ lên chính mình
    
    local char = player.Character
    if not char then return end

    -- 1. Tạo Highlight (Viền sáng xuyên tường)
    local highlight = Instance.new("Highlight")
    highlight.Name = "ScriptEsp"
    highlight.FillColor = Color3.fromRGB(0, 255, 0) -- Xanh lá
    highlight.OutlineColor = Color3.fromRGB(255, 255, 255)
    highlight.FillTransparency = 0.5
    highlight.OutlineTransparency = 0
    highlight.Adornee = char
    highlight.Parent = char

    -- 2. Tạo BillboardGui (Chữ trên đầu)
    local bg = Instance.new("BillboardGui")
    bg.Name = "EspName"
    bg.Adornee = char:FindFirstChild("Head") or char.PrimaryPart
    bg.Size = UDim2.new(0, 200, 0, 50)
    bg.StudsOffset = Vector3.new(0, 5.5, 0)
    bg.AlwaysOnTop = true
    
    local text = Instance.new("TextLabel")
    text.Parent = bg
    text.Size = UDim2.new(1, 0, 1, 0)
    text.BackgroundTransparency = 1
    text.Text = "🛡️ SCRIPT USER 🛡️\n" .. player.Name
    text.TextColor3 = Color3.fromRGB(0, 255, 0)
    text.TextStrokeTransparency = 0
    text.TextSize = 14
    text.Font = Enum.Font.GothamBold
    
    bg.Parent = char

    EspCache[player.Name] = {highlight, bg}
    print("🟢 Đã phát hiện đồng đội:", player.Name)
end

local function RemoveEsp(playerName)
    if EspCache[playerName] then
        if EspCache[playerName][1] then EspCache[playerName][1]:Destroy() end
        if EspCache[playerName][2] then EspCache[playerName][2]:Destroy() end
        EspCache[playerName] = nil
    end
end

-- Hàm Heartbeat: Gửi tên mình lên server & nhận danh sách đồng đội
local function Heartbeat()
    local data = { username = LocalPlayer.Name }
    
    local success, response = pcall(function()
        return request({
            Url = API_HEARTBEAT,
            Method = "POST",
            Headers = { 
                ["Content-Type"] = "application/json",
                ["Bypass-Tunnel-Reminder"] = "true",
                ["User-Agent"] = "Roblox/WinInet"
            },
            Body = HttpService:JSONEncode(data)
        })
    end)

    if success and response.StatusCode == 200 then
        local body = HttpService:JSONDecode(response.Body)
        local onlineUsers = body.users or {}
        
        -- Chuyển danh sách online thành map để dễ tra cứu
        local onlineMap = {}
        for _, username in ipairs(onlineUsers) do
            onlineMap[username] = true
            local p = Players:FindFirstChild(username)
            if p then
                CreateEsp(p)
            end
        end
        
        -- Xóa ESP của người đã offline hoặc không còn dùng script
        for name, _ in pairs(EspCache) do
            if not onlineMap[name] then
                RemoveEsp(name)
            end
        end
    else
        -- Nếu lỗi kết nối server (server tắt), xóa hết ESP để tránh hiểu nhầm
        if not success then
            -- warn("❌ Mất kết nối tới server script")
        end
    end
end

-- Chạy Heartbeat mỗi 3 giây
task.spawn(function()
    while task.wait(3) do
        Heartbeat()
    end
end)

-- Xử lý khi nhân vật chết/respawn (vẽ lại ESP)
Players.PlayerAdded:Connect(function(player)
    player.CharacterAdded:Connect(function()
        -- Đợi heartbeat tiếp theo sẽ tự vẽ lại
    end)
end)

for _, p in ipairs(Players:GetPlayers()) do
    p.CharacterAdded:Connect(function()
        -- Đợi heartbeat tiếp theo
    end)
end

game:GetService("StarterGui"):SetCore("SendNotification", { 
    Title = "SCRIPT USER ESP"; 
    Text = "Đang kết nối server..."; 
    Duration = 5; 
})
print("🚀 Script Loaded: Chỉ hiện người dùng Script")