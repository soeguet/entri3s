FROM ubuntu:26.04
 
ENV DEBIAN_FRONTEND=noninteractive
ENV MISE_YES=1
 
RUN apt-get update && apt-get install -y \
    curl \
    git \
    byobu \
    openssh-server \
    build-essential \
    pkg-config \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    gcc-mingw-w64 \
    && rm -rf /var/lib/apt/lists/*
 
RUN curl https://mise.run | sh
 
ENV PATH="/root/.local/share/mise/shims:/root/.local/bin:/root/go/bin:$PATH"
 
RUN echo 'export PATH="/root/.local/bin:$PATH"' >> /root/.bashrc && \
    echo 'eval "$(mise activate bash)"' >> /root/.bashrc

RUN mise use -g node@latest npm@latest bun@latest oxlint@latest oxfmt@latest claude@latest neovim@latest python@3.13 zellij@latest
 
RUN mkdir -p /root/.ssh && \
    echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICAe1ai1jCaHXlabrKZ8Y+iGJ9PjXDHB5o/CzFgMUsfb soeguet.osman@gmail.com" \
    > /root/.ssh/authorized_keys && \
    chmod 700 /root/.ssh && \
    chmod 600 /root/.ssh/authorized_keys
 
RUN mkdir -p /etc/ssh/sshd_config.d && \
    printf "PermitRootLogin prohibit-password\nPasswordAuthentication no\n" \
    > /etc/ssh/sshd_config.d/docker.conf
 
WORKDIR /workspace
 
CMD ["/bin/sh", "-c", "ssh-keygen -A && /usr/sbin/sshd -D && mise use -g bun@latest oxlint@latest oxfmt@latest claude@latest neovim@latest python@3.13 zellij@latest"]