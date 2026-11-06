<<<<<<< HEAD
# Cashflip em outros dispositivos

O computador que hospeda o sistema pode estar conectado ao roteador por cabo de rede. Para acessar pelo celular ou tablet, conecte-o ao Wi-Fi desse mesmo roteador; ambos precisam estar na mesma rede local.

1. No computador que hospeda o projeto, inicie o sistema executando `python app.py` dentro da pasta `backend`.
2. Execute `ipconfig` no computador e identifique o endereço IPv4 do adaptador Ethernet (conexão cabeada).
3. No celular ou tablet conectado ao Wi-Fi do mesmo roteador, abra `http://IP-DO-COMPUTADOR:5000/`, substituindo `IP-DO-COMPUTADOR` pelo IPv4 encontrado. Por exemplo: `http://192.168.20.104:5000/`.
4. Se o Windows solicitar, permita o acesso do Python à rede privada. Não é necessário iniciar o Live Server: o backend também serve as páginas do site.

O frontend usa automaticamente o mesmo endereço para se conectar à API. Esse modo é para testes em uma rede local confiável; não exponha o servidor diretamente à internet.
=======
# tcc_online
>>>>>>> 21c079ca5c1db145039c08732cf004b357ec6685
