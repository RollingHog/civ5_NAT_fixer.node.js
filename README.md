# civ5_NAT_fixer.node.js
Fixes Civ5 and CivBE multiplayer "turn doesn't end" problem when one of players is behind the NAT

Here 
* TARGET is computer behind the NAT which can't be reached 
* CALLER is computer which needs (ICMP) connection to TARGET

TARGET is suspected to be behind the NAT if CALLER can't ping TARGET public IP. It doesn't matter if TARGET is Civ5 hoster or client.

### Usage


### Exact algorithm
* CALLER does `tracert` to TARGET public IP and searches for server with `NAT` in name
* CALLER executes civ5_routes_add.bat