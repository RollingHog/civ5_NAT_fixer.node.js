@echo off
REM run this on CALLER computer which can't reach TARGET computer placed behind the NAT

REM to acquire, run "ipconfig" on TARGET and find "ethernet adapter ethernet"
set target_LAN_IP=192.168.1.100
set target_VPN_IP=25.3.17.99
set target_router=192.168.1.1
set target_router_local_mask=192.168.1.1 
set target_router_external_mask=255.255.252.0
set target_NAT_IP=188.65.69.72

echo route add %target_LAN_IP% mask %target_router_local_mask% %target_VPN_IP%
echo route add %target_router% mask %target_router_local_mask% %target_LAN_IP%
echo route add %target_NAT_IP% mask %target_router_external_mask% %target_router%

REM TODO unroute
REM example NAT name: v181.nat7.cv19.at-home.ru [188.65.69.72]

REM execute this on TARGET computer
REM or just run: netsh interface ip show config "Ethernet"

REM https://stackoverflow.com/questions/4440014/how-to-get-the-ip-address-of-a-particular-adapter-in-windows-xp-through-command/4440183
REM https://stackoverflow.com/questions/22307698/reading-a-specific-line-in-a-text-file-to-a-variable-in-a-batch-file
pause
:end